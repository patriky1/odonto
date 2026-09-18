const db = require('../database/db');

/* ================================================================== *
 * CONSTANTES
 * ================================================================== */

// Numeração FDI — permanentes (11-48) e decíduos (51-85)
const DENTES_VALIDOS = new Set([
  ...[1, 2, 3, 4].flatMap((q) => [1, 2, 3, 4, 5, 6, 7, 8].map((d) => q * 10 + d)),
  ...[5, 6, 7, 8].flatMap((q) => [1, 2, 3, 4, 5].map((d) => q * 10 + d)),
]);

// V=Vestibular, L=Lingual/Palatina, M=Mesial, D=Distal, O=Oclusal/Incisal
const FACES_VALIDAS = ['V', 'L', 'M', 'D', 'O'];

const STATUS_VALIDOS = [
  '', 'higido', 'cariado', 'restaurado', 'ausente', 'indicado_extracao',
  'protese', 'tratamento_canal', 'implante', 'selante', 'fraturado', 'em_tratamento',
];

const normalizarFace = (face) => {
  if (!face) return null;
  const f = String(face).trim().toUpperCase();
  return FACES_VALIDAS.includes(f) ? f : null;
};

const registrarHistorico = ({ pacienteId, numeroDente, face, statusAnterior, statusNovo, procedimento, observacoes, usuario, acao = 'atualizacao' }) => {
  try {
    db.prepare(`INSERT INTO odontograma_historico
      (pacienteId, numeroDente, face, statusAnterior, statusNovo, procedimento, observacoes, usuarioId, usuarioNome, acao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pacienteId, numeroDente, face || null, statusAnterior || null, statusNovo || null,
        procedimento || null, observacoes || null, usuario?.id || null, usuario?.nome || null, acao);
  } catch (e) {
    console.warn('⚠️  Falha ao registrar histórico do odontograma:', e.message);
  }
};

/* ================================================================== *
 * CONSULTA
 * ================================================================== */

/**
 * Retorna o odontograma completo do paciente:
 * dados do paciente + registros por dente (com faces) + ficha clínica + resumo.
 */
exports.buscarPorPaciente = (req, res) => {
  try {
    const { pacienteId } = req.params;

    const paciente = db.prepare(
      `SELECT id, nome, cpf, dataNascimento, sexo, telefone, whatsapp, email, responsavel, observacoes
       FROM pacientes WHERE id = ?`
    ).get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const registros = db.prepare(
      'SELECT * FROM odontograma WHERE pacienteId = ? ORDER BY numeroDente, face'
    ).all(pacienteId);

    // Agrupa por dente: { 11: { geral: {...}, faces: { V: {...} } } }
    const dentes = {};
    for (const r of registros) {
      const chave = r.numeroDente;
      dentes[chave] = dentes[chave] || { numeroDente: r.numeroDente, geral: null, faces: {} };
      if (r.face) dentes[chave].faces[r.face] = r;
      else dentes[chave].geral = r;
    }

    const ficha = db.prepare('SELECT * FROM odontograma_ficha WHERE pacienteId = ?').get(pacienteId) || null;

    // Resumo clínico
    const resumo = db.prepare(
      `SELECT COALESCE(status, 'higido') AS status, COUNT(*) AS total
       FROM odontograma WHERE pacienteId = ? AND face IS NULL
       GROUP BY COALESCE(status, 'higido')`
    ).all(pacienteId);

    const ultimaAtualizacao = db.prepare(
      "SELECT MAX(updatedAt) AS t FROM odontograma WHERE pacienteId = ?"
    ).get(pacienteId).t;

    res.json({
      paciente,
      registros,       // formato antigo, mantido por compatibilidade
      dentes,
      ficha,
      resumo,
      ultimaAtualizacao,
      totalRegistros: registros.length,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Histórico de alterações (auditoria clínica). */
exports.historico = (req, res) => {
  try {
    const { pacienteId } = req.params;
    const { numeroDente, limite = 100 } = req.query;
    let sql = 'SELECT * FROM odontograma_historico WHERE pacienteId = ?';
    const params = [pacienteId];
    if (numeroDente) { sql += ' AND numeroDente = ?'; params.push(numeroDente); }
    sql += ' ORDER BY createdAt DESC, id DESC LIMIT ?';
    params.push(parseInt(limite) || 100);
    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/* ================================================================== *
 * GRAVAÇÃO
 * ================================================================== */

const salvarDente = (pacienteId, dados, usuario) => {
  const numeroDente = parseInt(dados.numeroDente);
  if (!numeroDente || !DENTES_VALIDOS.has(numeroDente)) {
    throw Object.assign(new Error(`Dente ${dados.numeroDente} inválido (use a numeração FDI)`), { status: 400 });
  }
  const face = normalizarFace(dados.face);
  const status = dados.status === undefined ? null : (dados.status || null);
  if (status && !STATUS_VALIDOS.includes(status)) {
    throw Object.assign(new Error(`Status "${status}" não reconhecido`), { status: 400 });
  }

  const existente = db.prepare(
    'SELECT * FROM odontograma WHERE pacienteId = ? AND numeroDente = ? AND face IS ?'
  ).get(pacienteId, numeroDente, face);

  const procedimento = dados.procedimento !== undefined ? (dados.procedimento || null) : existente?.procedimento || null;
  const observacoes = dados.observacoes !== undefined ? (dados.observacoes || null) : existente?.observacoes || null;

  // Registro vazio: se não há mais nada a guardar, remove a marcação
  const vazio = !status && !procedimento && !observacoes;

  if (existente && vazio) {
    db.prepare('DELETE FROM odontograma WHERE id = ?').run(existente.id);
    registrarHistorico({
      pacienteId, numeroDente, face, statusAnterior: existente.status,
      statusNovo: null, usuario, acao: 'remocao',
    });
    return null;
  }

  if (existente) {
    db.prepare(`UPDATE odontograma SET status=?, procedimento=?, observacoes=?, data=COALESCE(?, data),
                usuarioId=?, dentistaId=?, updatedAt=datetime('now') WHERE id=?`)
      .run(status, procedimento, observacoes, dados.data || null,
        usuario?.id || null, dados.dentistaId || existente.dentistaId || null, existente.id);
    if (existente.status !== status || existente.procedimento !== procedimento) {
      registrarHistorico({
        pacienteId, numeroDente, face, statusAnterior: existente.status, statusNovo: status,
        procedimento, observacoes, usuario, acao: 'atualizacao',
      });
    }
    return db.prepare('SELECT * FROM odontograma WHERE id = ?').get(existente.id);
  }

  if (vazio) return null;

  const r = db.prepare(`INSERT INTO odontograma
      (pacienteId, numeroDente, face, status, procedimento, observacoes, data, usuarioId, dentistaId)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, ?)`)
    .run(pacienteId, numeroDente, face, status, procedimento, observacoes,
      dados.data || null, usuario?.id || null, dados.dentistaId || null);

  registrarHistorico({
    pacienteId, numeroDente, face, statusAnterior: null, statusNovo: status,
    procedimento, observacoes, usuario, acao: 'criacao',
  });
  return db.prepare('SELECT * FROM odontograma WHERE id = ?').get(r.lastInsertRowid);
};

/**
 * Salva um dente (com ou sem face).
 * Aceita o pacienteId pela URL (/paciente/:pacienteId) ou pelo corpo da requisição,
 * garantindo compatibilidade com chamadas antigas do frontend.
 */
exports.salvar = (req, res) => {
  try {
    const pacienteId = req.params.pacienteId || req.body.pacienteId;
    if (!pacienteId) return res.status(400).json({ erro: 'Paciente não informado', error: 'Paciente não informado' });

    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    if (!req.body.numeroDente) {
      return res.status(400).json({ erro: 'Número do dente é obrigatório', error: 'Número do dente é obrigatório' });
    }

    const salvo = salvarDente(pacienteId, req.body, req.usuario);
    res.status(salvo ? 200 : 200).json(salvo || { mensagem: 'Registro removido', removido: true });
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

/** Salva vários dentes/faces de uma vez (salvamento em lote da tela). */
exports.salvarLote = (req, res) => {
  try {
    const pacienteId = req.params.pacienteId || req.body.pacienteId;
    const { dentes } = req.body;
    if (!Array.isArray(dentes) || dentes.length === 0) {
      return res.status(400).json({ erro: 'Envie a lista de dentes', error: 'Envie a lista de dentes' });
    }
    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const salvarTodos = db.transaction ? null : null; // node:sqlite não expõe transaction(); usamos SQL direto
    db.exec('BEGIN');
    try {
      const salvos = dentes.map((d) => salvarDente(pacienteId, d, req.usuario)).filter(Boolean);
      db.exec('COMMIT');
      res.json({ mensagem: `${salvos.length} registro(s) salvo(s)`, salvos });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

/** Ficha clínica do odontograma (dados gerais do paciente nesta tela). */
exports.salvarFicha = (req, res) => {
  try {
    const { pacienteId } = req.params;
    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const { queixaPrincipal, anamnese, alertas, observacoesGerais, dentistaId } = req.body;
    const existe = db.prepare('SELECT pacienteId FROM odontograma_ficha WHERE pacienteId = ?').get(pacienteId);

    if (existe) {
      db.prepare(`UPDATE odontograma_ficha SET queixaPrincipal=?, anamnese=?, alertas=?, observacoesGerais=?,
                  dentistaId=?, atualizadoPor=?, updatedAt=datetime('now') WHERE pacienteId=?`)
        .run(queixaPrincipal || null, anamnese || null, alertas || null, observacoesGerais || null,
          dentistaId || null, req.usuario?.nome || null, pacienteId);
    } else {
      db.prepare(`INSERT INTO odontograma_ficha
        (pacienteId, queixaPrincipal, anamnese, alertas, observacoesGerais, dentistaId, atualizadoPor)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(pacienteId, queixaPrincipal || null, anamnese || null, alertas || null,
          observacoesGerais || null, dentistaId || null, req.usuario?.nome || null);
    }

    res.json(db.prepare('SELECT * FROM odontograma_ficha WHERE pacienteId = ?').get(pacienteId));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/* ================================================================== *
 * EXCLUSÃO
 * ================================================================== */

exports.excluir = (req, res) => {
  try {
    const { pacienteId, numeroDente } = req.params;
    const face = normalizarFace(req.query.face);

    const alvo = face
      ? db.prepare('SELECT * FROM odontograma WHERE pacienteId = ? AND numeroDente = ? AND face = ?').all(pacienteId, numeroDente, face)
      : db.prepare('SELECT * FROM odontograma WHERE pacienteId = ? AND numeroDente = ?').all(pacienteId, numeroDente);

    if (alvo.length === 0) return res.status(404).json({ erro: 'Nenhum registro para este dente', error: 'Nenhum registro para este dente' });

    if (face) db.prepare('DELETE FROM odontograma WHERE pacienteId = ? AND numeroDente = ? AND face = ?').run(pacienteId, numeroDente, face);
    else db.prepare('DELETE FROM odontograma WHERE pacienteId = ? AND numeroDente = ?').run(pacienteId, numeroDente);

    alvo.forEach((a) => registrarHistorico({
      pacienteId, numeroDente: a.numeroDente, face: a.face,
      statusAnterior: a.status, statusNovo: null, usuario: req.usuario, acao: 'remocao',
    }));

    res.json({ mensagem: 'Registro excluído', removidos: alvo.length });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Limpa todo o odontograma do paciente (reinicia o mapa dental). */
exports.limpar = (req, res) => {
  try {
    const { pacienteId } = req.params;
    const total = db.prepare('SELECT COUNT(*) AS c FROM odontograma WHERE pacienteId = ?').get(pacienteId).c;
    db.prepare('DELETE FROM odontograma WHERE pacienteId = ?').run(pacienteId);
    registrarHistorico({
      pacienteId, numeroDente: 0, statusAnterior: null, statusNovo: null,
      observacoes: `Odontograma reiniciado (${total} registros removidos)`,
      usuario: req.usuario, acao: 'limpeza',
    });
    res.json({ mensagem: 'Odontograma limpo', removidos: total });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.constantes = (req, res) => {
  res.json({ faces: FACES_VALIDAS, status: STATUS_VALIDOS, dentes: [...DENTES_VALIDOS] });
};
