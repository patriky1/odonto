const db = require('../database/db');

exports.listar = (req, res) => {
  const { busca = '' } = req.query;
  const like = `%${busca}%`;
  const rows = db.prepare("SELECT * FROM procedimentos WHERE ativo = 1 AND (nome LIKE ? OR descricao LIKE ?) ORDER BY nome").all(like, like);
  rows.forEach(r => r.ativo = Boolean(r.ativo));
  res.json(rows);
};

exports.criar = (req, res) => {
  try {
    const { nome, descricao, valor = 0, duracao } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
    const r = db.prepare("INSERT INTO procedimentos (nome, descricao, valor, duracao) VALUES (?, ?, ?, ?)").run(nome, descricao||null, valor, duracao||null);
    const novo = db.prepare('SELECT * FROM procedimentos WHERE id = ?').get(r.lastInsertRowid);
    novo.ativo = Boolean(novo.ativo);
    res.status(201).json(novo);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const p = db.prepare('SELECT * FROM procedimentos WHERE id = ? AND ativo = 1').get(id);
    if (!p) return res.status(404).json({ erro: 'Procedimento não encontrado' });
    const { nome, descricao, valor, duracao } = req.body;
    db.prepare("UPDATE procedimentos SET nome=?, descricao=?, valor=?, duracao=?, updatedAt=datetime('now') WHERE id=?")
      .run(nome||p.nome, descricao||p.descricao, valor !== undefined ? valor : p.valor, duracao||p.duracao, id);
    const atualizado = db.prepare('SELECT * FROM procedimentos WHERE id = ?').get(id);
    atualizado.ativo = Boolean(atualizado.ativo);
    res.json(atualizado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.excluir = (req, res) => {
  const p = db.prepare('SELECT id FROM procedimentos WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Procedimento não encontrado' });
  db.prepare("UPDATE procedimentos SET ativo = 0, updatedAt = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ mensagem: 'Procedimento removido' });
};
