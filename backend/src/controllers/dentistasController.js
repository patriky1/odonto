const db = require('../database/db');

exports.listar = (req, res) => {
  const rows = db.prepare(`SELECT d.*, u.nome AS usuarioNome, u.email AS usuarioEmail
                           FROM dentistas d LEFT JOIN usuarios u ON d.usuarioId = u.id
                           WHERE d.ativo = 1 ORDER BY d.nome`).all();
  rows.forEach(r => { r.ativo = Boolean(r.ativo); });
  res.json(rows);
};

/** Usuários com perfil de dentista disponíveis para vínculo. */
exports.usuariosDisponiveis = (req, res) => {
  const rows = db.prepare(`SELECT u.id, u.nome, u.email,
      (SELECT d.nome FROM dentistas d WHERE d.usuarioId = u.id AND d.ativo = 1) AS vinculadoA
    FROM usuarios u WHERE u.perfil = 'dentista' AND u.ativo = 1 ORDER BY u.nome`).all();
  res.json(rows);
};

exports.buscarPorId = (req, res) => {
  const d = db.prepare('SELECT * FROM dentistas WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!d) return res.status(404).json({ erro: 'Dentista não encontrado' });
  d.ativo = Boolean(d.ativo);
  res.json(d);
};

exports.criar = (req, res) => {
  try {
    const { nome, cro, especialidade, telefone, email, diasAtendimento, horariosDisponiveis, usuarioId } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório', error: 'Nome é obrigatório' });
    // Um usuário só pode estar vinculado a um dentista
    if (usuarioId) {
      const jaVinculado = db.prepare('SELECT nome FROM dentistas WHERE usuarioId = ?').get(usuarioId);
      if (jaVinculado) return res.status(400).json({ erro: `Este usuário já está vinculado ao dentista ${jaVinculado.nome}`, error: `Este usuário já está vinculado ao dentista ${jaVinculado.nome}` });
    }
    const r = db.prepare("INSERT INTO dentistas (nome, cro, especialidade, telefone, email, diasAtendimento, horariosDisponiveis, usuarioId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(nome, cro||null, especialidade||null, telefone||null, email||null, Array.isArray(diasAtendimento) ? JSON.stringify(diasAtendimento) : (diasAtendimento||null), typeof horariosDisponiveis === 'object' ? JSON.stringify(horariosDisponiveis) : (horariosDisponiveis||null), usuarioId||null);
    const novo = db.prepare('SELECT * FROM dentistas WHERE id = ?').get(r.lastInsertRowid);
    novo.ativo = Boolean(novo.ativo);
    res.status(201).json(novo);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const d = db.prepare('SELECT * FROM dentistas WHERE id = ? AND ativo = 1').get(id);
    if (!d) return res.status(404).json({ erro: 'Dentista não encontrado' });
    const { nome, cro, especialidade, telefone, email, diasAtendimento, horariosDisponiveis, usuarioId } = req.body;
    if (usuarioId) {
      const jaVinculado = db.prepare('SELECT nome FROM dentistas WHERE usuarioId = ? AND id != ?').get(usuarioId, id);
      if (jaVinculado) return res.status(400).json({ erro: `Este usuário já está vinculado ao dentista ${jaVinculado.nome}`, error: `Este usuário já está vinculado ao dentista ${jaVinculado.nome}` });
    }
    const dias = diasAtendimento !== undefined ? (Array.isArray(diasAtendimento) ? JSON.stringify(diasAtendimento) : diasAtendimento) : d.diasAtendimento;
    const horarios = horariosDisponiveis !== undefined ? (typeof horariosDisponiveis === 'object' ? JSON.stringify(horariosDisponiveis) : horariosDisponiveis) : d.horariosDisponiveis;
    db.prepare("UPDATE dentistas SET nome=?, cro=?, especialidade=?, telefone=?, email=?, diasAtendimento=?, horariosDisponiveis=?, usuarioId=?, updatedAt=datetime('now') WHERE id=?")
      .run(nome||d.nome, cro||d.cro, especialidade||d.especialidade, telefone||d.telefone, email||d.email, dias, horarios,
        usuarioId !== undefined ? (usuarioId || null) : d.usuarioId, id);
    const atualizado = db.prepare('SELECT * FROM dentistas WHERE id = ?').get(id);
    atualizado.ativo = Boolean(atualizado.ativo);
    res.json(atualizado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.excluir = (req, res) => {
  const d = db.prepare('SELECT id FROM dentistas WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!d) return res.status(404).json({ erro: 'Dentista não encontrado' });
  db.prepare("UPDATE dentistas SET ativo = 0, updatedAt = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ mensagem: 'Dentista removido' });
};

exports.agenda = (req, res) => {
  const { data } = req.query;
  const { id } = req.params;
  const agendamentos = db.prepare("SELECT a.*, p.nome as pacienteNome FROM agendamentos a LEFT JOIN pacientes p ON a.pacienteId = p.id WHERE a.dentistaId = ? AND a.data = ? ORDER BY a.horaInicio").all(id, data);
  res.json(agendamentos);
};
