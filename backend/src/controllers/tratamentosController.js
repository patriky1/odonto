const db = require('../database/db');
const { salvarDataUrl, removerArquivo } = require('./uploadController');
const { autor, registrarAuditoria } = require('../utils/auditoria');

const ROTULO_STATUS = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };

const nomePaciente = (id) => db.prepare('SELECT nome FROM pacientes WHERE id = ?').get(id)?.nome || `Paciente #${id}`;

const auditar = (req, acao, t, extra = '') => registrarAuditoria(req, {
  entidade: 'tratamento',
  entidadeId: t?.id,
  acao,
  descricao: `${t?.nome || 'Tratamento'} — ${nomePaciente(t?.pacienteId)}${extra ? ` (${extra})` : ''}`,
  pacienteId: t?.pacienteId,
  dentistaId: t?.dentistaId,
});

exports.listar = (req, res) => {
  const { pacienteId, status, comFotos, dentistaId } = req.query;
  let sql = `SELECT t.*, p.nome as pacienteNome, d.nome as dentistaNome
             FROM tratamentos t
             LEFT JOIN pacientes p ON t.pacienteId = p.id
             LEFT JOIN dentistas d ON t.dentistaId = d.id
             WHERE 1=1`;
  const params = [];
  if (pacienteId) { sql += ' AND t.pacienteId = ?'; params.push(pacienteId); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (dentistaId) { sql += ' AND t.dentistaId = ?'; params.push(dentistaId); }
  if (comFotos === 'true') { sql += ' AND (t.fotoAntes IS NOT NULL OR t.fotoDepois IS NOT NULL)'; }
  sql += ' ORDER BY t.createdAt DESC';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => { r.paciente = { id: r.pacienteId, nome: r.pacienteNome }; delete r.pacienteNome; });
  res.json(rows);
};

exports.buscarPorId = (req, res) => {
  const t = db.prepare("SELECT t.*, p.nome as pacienteNome FROM tratamentos t LEFT JOIN pacientes p ON t.pacienteId = p.id WHERE t.id = ?").get(req.params.id);
  if (!t) return res.status(404).json({ erro: 'Tratamento não encontrado', error: 'Tratamento não encontrado' });
  t.paciente = { id: t.pacienteId, nome: t.pacienteNome }; delete t.pacienteNome;
  res.json(t);
};

exports.criar = (req, res) => {
  try {
    const { pacienteId, nome, descricao, valor = 0, sessoes = 1, sessoesRealizadas = 0, status = 'nao_iniciado', dentistaId, fotoAntes, fotoDepois } = req.body;
    if (!pacienteId || !nome) return res.status(400).json({ erro: 'Paciente e nome são obrigatórios', error: 'Paciente e nome são obrigatórios' });

    // As fotos são opcionais — o tratamento salva normalmente sem elas
    const caminhoAntes = fotoAntes ? salvarDataUrl(fotoAntes, 'tratamentos') : null;
    const caminhoDepois = fotoDepois ? salvarDataUrl(fotoDepois, 'tratamentos') : null;

    const quem = autor(req);
    const r = db.prepare(`INSERT INTO tratamentos
      (pacienteId, nome, descricao, valor, sessoes, sessoesRealizadas, status, dentistaId, fotoAntes, fotoDepois, criadoPorId, criadoPorNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pacienteId, nome, descricao||null, valor, sessoes, sessoesRealizadas, status, dentistaId||null,
        caminhoAntes, caminhoDepois, quem.id, quem.nome);
    const criado = db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(r.lastInsertRowid);
    auditar(req, 'criou', criado);
    res.status(201).json(criado);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const t = db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(id);
    if (!t) return res.status(404).json({ erro: 'Tratamento não encontrado', error: 'Tratamento não encontrado' });
    const { nome, descricao, valor, sessoes, sessoesRealizadas, status, dentistaId, fotoAntes, fotoDepois } = req.body;

    // Fotos: undefined = não mexe | null/'' = remove | data URL = substitui
    let caminhoAntes = t.fotoAntes;
    if (fotoAntes !== undefined) {
      if (!fotoAntes) { removerArquivo(t.fotoAntes); caminhoAntes = null; }
      else {
        const novo = salvarDataUrl(fotoAntes, 'tratamentos');
        if (novo !== t.fotoAntes) removerArquivo(t.fotoAntes);
        caminhoAntes = novo;
      }
    }
    let caminhoDepois = t.fotoDepois;
    if (fotoDepois !== undefined) {
      if (!fotoDepois) { removerArquivo(t.fotoDepois); caminhoDepois = null; }
      else {
        const novo = salvarDataUrl(fotoDepois, 'tratamentos');
        if (novo !== t.fotoDepois) removerArquivo(t.fotoDepois);
        caminhoDepois = novo;
      }
    }

    const quem = autor(req);
    db.prepare(`UPDATE tratamentos SET nome=?, descricao=?, valor=?, sessoes=?, sessoesRealizadas=?, status=?, dentistaId=?,
                fotoAntes=?, fotoDepois=?, atualizadoPorId=?, atualizadoPorNome=?, updatedAt=datetime('now') WHERE id=?`)
      .run(nome||t.nome, descricao ?? t.descricao, valor !== undefined ? valor : t.valor,
        sessoes||t.sessoes, sessoesRealizadas !== undefined ? sessoesRealizadas : t.sessoesRealizadas,
        status||t.status, dentistaId !== undefined ? (dentistaId||null) : t.dentistaId,
        caminhoAntes, caminhoDepois, quem.id, quem.nome, id);
    const atualizado = db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(id);
    const mudancas = [];
    if (t.status !== atualizado.status) mudancas.push(`status: ${ROTULO_STATUS[t.status] || t.status} → ${ROTULO_STATUS[atualizado.status] || atualizado.status}`);
    if (t.sessoesRealizadas !== atualizado.sessoesRealizadas) mudancas.push(`sessões: ${atualizado.sessoesRealizadas}/${atualizado.sessoes}`);
    if (Number(t.valor) !== Number(atualizado.valor)) mudancas.push('valor alterado');
    auditar(req, 'editou', atualizado, mudancas.join('; '));
    res.json(atualizado);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

exports.excluir = (req, res) => {
  const t = db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ erro: 'Tratamento não encontrado', error: 'Tratamento não encontrado' });
  // Não deixa imagens órfãs no disco
  removerArquivo(t.fotoAntes);
  removerArquivo(t.fotoDepois);
  db.prepare('DELETE FROM tratamentos WHERE id = ?').run(req.params.id);
  auditar(req, 'excluiu', t);
  res.json({ mensagem: 'Tratamento excluído' });
};
