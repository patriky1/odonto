const db = require('../database/db');

exports.listar = (req, res) => {
  const { pacienteId } = req.query;
  let sql = "SELECT pr.*, p.nome as pacienteNome, d.nome as dentistaNome FROM prontuarios pr LEFT JOIN pacientes p ON pr.pacienteId = p.id LEFT JOIN dentistas d ON pr.dentistaId = d.id WHERE 1=1";
  const params = [];
  if (pacienteId) { sql += ' AND pr.pacienteId = ?'; params.push(pacienteId); }
  sql += ' ORDER BY pr.data DESC';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => {
    r.paciente = { nome: r.pacienteNome }; delete r.pacienteNome;
    r.dentista = { nome: r.dentistaNome }; delete r.dentistaNome;
  });
  res.json(rows);
};

exports.buscarPorId = (req, res) => {
  const pr = db.prepare("SELECT pr.*, p.nome as pacienteNome, d.nome as dentistaNome FROM prontuarios pr LEFT JOIN pacientes p ON pr.pacienteId = p.id LEFT JOIN dentistas d ON pr.dentistaId = d.id WHERE pr.id = ?").get(req.params.id);
  if (!pr) return res.status(404).json({ erro: 'Prontuário não encontrado' });
  pr.paciente = { nome: pr.pacienteNome }; delete pr.pacienteNome;
  pr.dentista = { nome: pr.dentistaNome }; delete pr.dentistaNome;
  res.json(pr);
};

exports.criar = (req, res) => {
  try {
    const { pacienteId, dentistaId, queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes, data } = req.body;
    if (!pacienteId) return res.status(400).json({ erro: 'Paciente é obrigatório' });
    const r = db.prepare("INSERT INTO prontuarios (pacienteId, dentistaId, usuarioId, queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))").run(pacienteId, dentistaId||null, req.usuario.id, queixaPrincipal||null, historico||null, diagnostico||null, observacoes||null, evolucao||null, procedimentos||null, medicamentos||null, anotacoes||null, data||null);
    res.status(201).json(db.prepare('SELECT * FROM prontuarios WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const pr = db.prepare('SELECT * FROM prontuarios WHERE id = ?').get(id);
    if (!pr) return res.status(404).json({ erro: 'Prontuário não encontrado' });
    const { queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes, data, dentistaId } = req.body;
    db.prepare("UPDATE prontuarios SET dentistaId=?, queixaPrincipal=?, historico=?, diagnostico=?, observacoes=?, evolucao=?, procedimentos=?, medicamentos=?, anotacoes=?, data=?, updatedAt=datetime('now') WHERE id=?")
      .run(dentistaId||pr.dentistaId, queixaPrincipal||pr.queixaPrincipal, historico||pr.historico, diagnostico||pr.diagnostico, observacoes||pr.observacoes, evolucao||pr.evolucao, procedimentos||pr.procedimentos, medicamentos||pr.medicamentos, anotacoes||pr.anotacoes, data||pr.data, id);
    res.json(db.prepare('SELECT * FROM prontuarios WHERE id = ?').get(id));
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.excluir = (req, res) => {
  const pr = db.prepare('SELECT id FROM prontuarios WHERE id = ?').get(req.params.id);
  if (!pr) return res.status(404).json({ erro: 'Prontuário não encontrado' });
  db.prepare('DELETE FROM prontuarios WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Prontuário excluído' });
};
