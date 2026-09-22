const db = require('../database/db');
const { escopoAgenda, dentistaDoUsuario, podeVerAgendamento } = require('../utils/escopo');
const { hojeISO, somarDias } = require('../utils/datas');
const { autor, registrarAuditoria } = require('../utils/auditoria');

const SELECT_BASE = `SELECT a.*, p.nome as pacienteNome, p.telefone as pacienteTelefone, p.whatsapp as pacienteWhatsapp,
  d.nome as dentistaNome, pr.nome as procedimentoNome, s.nome as salaNome
  FROM agendamentos a
  LEFT JOIN pacientes p ON a.pacienteId = p.id
  LEFT JOIN dentistas d ON a.dentistaId = d.id
  LEFT JOIN procedimentos pr ON a.procedimentoId = pr.id
  LEFT JOIN salas s ON a.salaId = s.id`;

// Status que não ocupam horário na agenda
const STATUS_LIVRES = "('cancelado','faltou','nao_compareceu')";

const negado = (res) => res.status(403).json({
  erro: 'Você só pode acessar os seus próprios agendamentos',
  error: 'Você só pode acessar os seus próprios agendamentos',
});

const erro = (res, status, msg) => res.status(status).json({ erro: msg, error: msg });

const ROTULO_STATUS = {
  agendado: 'Agendado', confirmado: 'Confirmado', em_atendimento: 'Em atendimento',
  concluido: 'Concluído', cancelado: 'Cancelado', nao_compareceu: 'Não compareceu', faltou: 'Faltou',
};

/** Texto curto do agendamento para o log de auditoria. */
const resumoAgendamento = (ag) => {
  if (!ag) return '';
  const data = ag.data ? ag.data.split('-').reverse().join('/') : '';
  return `${ag.pacienteNome || `Paciente #${ag.pacienteId}`} — ${data} às ${ag.horaInicio}`
    + (ag.dentistaNome ? ` com ${ag.dentistaNome}` : '');
};

const auditar = (req, acao, ag, extra = '') => registrarAuditoria(req, {
  entidade: 'agendamento',
  entidadeId: ag?.id,
  acao,
  descricao: `${resumoAgendamento(ag)}${extra ? ` (${extra})` : ''}`,
  pacienteId: ag?.pacienteId,
  dentistaId: ag?.dentistaId,
});

/**
 * Verifica choque de horário.
 *
 * Regras:
 *  - A mesma SALA não pode ter dois atendimentos ao mesmo tempo (qualquer dentista).
 *  - O mesmo DENTISTA não pode ter dois atendimentos ao mesmo tempo,
 *    EXCETO quando os dois estão marcados em salas diferentes
 *    (ex.: ortodontista atendendo em duas cadeiras).
 *  - Sem hora de término, mantém o comportamento antigo (não verifica).
 *
 * Retorna a mensagem de erro, ou null quando está livre.
 */
const verificarConflito = ({ id = null, dentistaId, salaId, data, horaInicio, horaFim }) => {
  if (!horaFim || !data || !horaInicio) return null;

  // Mesmo dia, status ativo, horários se sobrepondo e (na edição) outro registro
  const sobreposicao = `a.data = ? AND a.status NOT IN ${STATUS_LIVRES}
    AND ((a.horaInicio < ? AND a.horaFim > ?) OR (a.horaInicio >= ? AND a.horaInicio < ?))
    AND (? IS NULL OR a.id != ?)`;
  const args = [data, horaFim, horaInicio, horaInicio, horaFim, id, id];

  if (salaId) {
    const sala = db.prepare(`SELECT a.id, s.nome AS salaNome FROM agendamentos a
      LEFT JOIN salas s ON a.salaId = s.id
      WHERE a.salaId = ? AND ${sobreposicao}`)
      .get(salaId, ...args);
    if (sala) return `A ${sala.salaNome || 'sala'} já está ocupada neste horário`;
  }

  const doDentista = db.prepare(`SELECT a.id, a.salaId FROM agendamentos a WHERE a.dentistaId = ? AND ${sobreposicao}`)
    .all(dentistaId, ...args);
  // Choque só é permitido quando ambos estão em salas definidas e diferentes
  const bloqueia = doDentista.some((a) => !salaId || !a.salaId || Number(a.salaId) === Number(salaId));
  if (bloqueia) return 'Conflito de horário para este dentista (para atender em paralelo, informe salas diferentes)';

  return null;
};

/** Valida a sala informada; devolve o id (ou null) ou lança erro 400. */
const salaValida = (salaId) => {
  if (salaId === undefined || salaId === null || salaId === '') return null;
  const s = db.prepare('SELECT id FROM salas WHERE id = ? AND ativo = 1').get(salaId);
  if (!s) throw Object.assign(new Error('Sala não encontrada ou desativada'), { status: 400 });
  return s.id;
};

exports.listar = (req, res) => {
  try {
    const { data, pacienteId, status, dataInicio, dataFim, salaId } = req.query;
    const escopo = escopoAgenda(req.usuario, req.query.dentistaId);

    if (escopo.exigeSelecao) return res.json([]);

    let sql = `${SELECT_BASE} WHERE 1=1`;
    const params = [];
    if (data) { sql += ' AND a.data = ?'; params.push(data); }
    if (escopo.dentistaId) { sql += ' AND a.dentistaId = ?'; params.push(escopo.dentistaId); }
    if (salaId) { sql += ' AND a.salaId = ?'; params.push(salaId); }
    if (pacienteId) { sql += ' AND a.pacienteId = ?'; params.push(pacienteId); }
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (dataInicio) { sql += ' AND a.data >= ?'; params.push(dataInicio); }
    if (dataFim) { sql += ' AND a.data <= ?'; params.push(dataFim); }
    sql += ' ORDER BY a.data DESC, a.horaInicio DESC';

    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    erro(res, 500, e.message);
  }
};

/** Informa ao frontend qual escopo de agenda o usuário logado possui. */
exports.meuEscopo = (req, res) => {
  const perfil = req.usuario?.perfil;
  const dentista = perfil === 'dentista' ? dentistaDoUsuario(req.usuario) : null;
  res.json({
    perfil,
    veTodos: perfil !== 'dentista',
    exigeSelecaoDentista: false,
    dentistaId: dentista?.id || null,
    dentistaNome: dentista?.nome || null,
    semVinculo: perfil === 'dentista' && !dentista,
  });
};

exports.buscarPorId = (req, res) => {
  const a = db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(req.params.id);
  if (!a) return erro(res, 404, 'Agendamento não encontrado');
  if (!podeVerAgendamento(req.usuario, a)) return negado(res);
  res.json(a);
};

exports.criar = (req, res) => {
  try {
    const { pacienteId, procedimentoId, data, horaInicio, horaFim, status = 'agendado', observacoes } = req.body;
    let { dentistaId } = req.body;

    // O dentista logado só agenda para si mesmo
    if (req.usuario?.perfil === 'dentista') {
      const meu = dentistaDoUsuario(req.usuario);
      if (!meu) return erro(res, 403, 'Seu usuário não está vinculado a um cadastro de dentista');
      dentistaId = meu.id;
    }

    if (!pacienteId || !dentistaId || !data || !horaInicio) {
      return erro(res, 400, 'Campos obrigatórios ausentes');
    }
    if (horaFim && horaFim <= horaInicio) return erro(res, 400, 'A hora de término deve ser depois da hora de início');

    const salaId = salaValida(req.body.salaId);

    const conflito = verificarConflito({ dentistaId, salaId, data, horaInicio, horaFim });
    if (conflito) return erro(res, 400, conflito);

    const quem = autor(req);
    const r = db.prepare(`INSERT INTO agendamentos
      (pacienteId, dentistaId, procedimentoId, salaId, data, horaInicio, horaFim, status, observacoes, criadoPorId, criadoPorNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pacienteId, dentistaId, procedimentoId || null, salaId, data, horaInicio, horaFim || null, status,
        observacoes || null, quem.id, quem.nome);

    const criado = db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(r.lastInsertRowid);
    auditar(req, 'criou', criado);
    res.status(201).json(criado);
  } catch (e) {
    erro(res, e.status || 500, e.message);
  }
};

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const a = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(id);
    if (!a) return erro(res, 404, 'Agendamento não encontrado');
    if (!podeVerAgendamento(req.usuario, a)) return negado(res);

    const { pacienteId, procedimentoId, data, horaInicio, horaFim, status, observacoes } = req.body;
    let dentistaId = req.body.dentistaId;

    // Dentista não transfere o agendamento para outro profissional
    if (req.usuario?.perfil === 'dentista') dentistaId = a.dentistaId;

    const novo = {
      dentistaId: dentistaId || a.dentistaId,
      salaId: req.body.salaId !== undefined ? salaValida(req.body.salaId) : a.salaId,
      data: data || a.data,
      horaInicio: horaInicio || a.horaInicio,
      horaFim: horaFim || a.horaFim,
      status: status || a.status,
    };
    if (novo.horaFim && novo.horaFim <= novo.horaInicio) {
      return erro(res, 400, 'A hora de término deve ser depois da hora de início');
    }

    // Só verifica choque quando algo que ocupa horário mudou
    // (editar apenas observações de um agendamento antigo não é bloqueado)
    const mudouHorario = ['dentistaId', 'salaId', 'data', 'horaInicio', 'horaFim']
      .some((k) => String(novo[k] ?? '') !== String(a[k] ?? ''));
    const reativado = STATUS_LIVRES.includes(`'${a.status}'`) && !STATUS_LIVRES.includes(`'${novo.status}'`);
    if ((mudouHorario || reativado) && !STATUS_LIVRES.includes(`'${novo.status}'`)) {
      const conflito = verificarConflito({ id: a.id, ...novo });
      if (conflito) return erro(res, 400, conflito);
    }

    const quem = autor(req);
    db.prepare(`UPDATE agendamentos SET pacienteId=?, dentistaId=?, procedimentoId=?, salaId=?, data=?, horaInicio=?,
                horaFim=?, status=?, observacoes=?, atualizadoPorId=?, atualizadoPorNome=?, updatedAt=datetime('now') WHERE id=?`)
      .run(pacienteId || a.pacienteId, novo.dentistaId,
        procedimentoId !== undefined ? (procedimentoId || null) : a.procedimentoId,
        novo.salaId, novo.data, novo.horaInicio, novo.horaFim,
        novo.status, observacoes !== undefined ? (observacoes || null) : a.observacoes,
        quem.id, quem.nome, id);

    const atualizado = db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(id);
    const mudancas = [];
    if (mudouHorario) mudancas.push(`antes: ${a.data.split('-').reverse().join('/')} às ${a.horaInicio}`);
    if (a.status !== novo.status) mudancas.push(`status: ${ROTULO_STATUS[a.status] || a.status} → ${ROTULO_STATUS[novo.status] || novo.status}`);
    auditar(req, 'editou', atualizado, mudancas.join('; '));
    res.json(atualizado);
  } catch (e) {
    erro(res, e.status || 500, e.message);
  }
};

exports.excluir = (req, res) => {
  const a = db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(req.params.id);
  if (!a) return erro(res, 404, 'Agendamento não encontrado');
  if (!podeVerAgendamento(req.usuario, a)) return negado(res);
  db.prepare('DELETE FROM agendamentos WHERE id = ?').run(req.params.id);
  auditar(req, 'excluiu', a);
  res.json({ mensagem: 'Agendamento excluído' });
};

exports.alterarStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const a = db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(id);
  if (!a) return erro(res, 404, 'Agendamento não encontrado');
  if (!podeVerAgendamento(req.usuario, a)) return negado(res);
  if (!status) return erro(res, 400, 'Informe o novo status');
  const quem = autor(req);
  db.prepare(`UPDATE agendamentos SET status = ?, atualizadoPorId = ?, atualizadoPorNome = ?, updatedAt = datetime('now')
              WHERE id = ?`).run(status, quem.id, quem.nome, id);
  if (a.status !== status) {
    auditar(req, 'alterou status', a, `${ROTULO_STATUS[a.status] || a.status} → ${ROTULO_STATUS[status] || status}`);
  }
  res.json(db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(id));
};

exports.hoje = (req, res) => {
  const hoje = hojeISO();
  const escopo = escopoAgenda(req.usuario, req.query.dentistaId);

  let sql = `${SELECT_BASE} WHERE a.data = ?`;
  const params = [hoje];
  if (escopo.dentistaId) { sql += ' AND a.dentistaId = ?'; params.push(escopo.dentistaId); }
  sql += ' ORDER BY a.horaInicio';

  res.json(db.prepare(sql).all(...params));
};

/**
 * Lembretes por WhatsApp: agendamentos de uma data (padrão: amanhã),
 * com o telefone do paciente, para envio do lembrete da consulta.
 */
exports.lembretes = (req, res) => {
  try {
    const data = req.query.data || somarDias(hojeISO(), 1);
    const escopo = escopoAgenda(req.usuario, req.query.dentistaId);

    let sql = `${SELECT_BASE} WHERE a.data = ? AND a.status NOT IN ${STATUS_LIVRES} AND a.status != 'concluido'`;
    const params = [data];
    if (escopo.dentistaId) { sql += ' AND a.dentistaId = ?'; params.push(escopo.dentistaId); }
    sql += ' ORDER BY a.horaInicio';

    res.json({ data, agendamentos: db.prepare(sql).all(...params) });
  } catch (e) {
    erro(res, 500, e.message);
  }
};

/** Marca (ou desmarca) que o lembrete do agendamento foi enviado. */
exports.marcarLembrete = (req, res) => {
  const a = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(req.params.id);
  if (!a) return erro(res, 404, 'Agendamento não encontrado');
  if (!podeVerAgendamento(req.usuario, a)) return negado(res);
  const enviado = req.body?.enviado !== false;
  db.prepare("UPDATE agendamentos SET lembreteEnviadoEm = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?")
    .run(enviado ? 1 : 0, a.id);
  auditar(req, enviado ? 'enviou lembrete' : 'desmarcou lembrete',
    db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(a.id));
  res.json(db.prepare(`${SELECT_BASE} WHERE a.id = ?`).get(a.id));
};
