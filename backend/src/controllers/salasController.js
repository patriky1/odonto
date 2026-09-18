const db = require('../database/db');

const erro = (res, status, msg) => res.status(status).json({ erro: msg, error: msg });

/** Lista as salas. ?todas=true inclui as desativadas (tela de configurações). */
exports.listar = (req, res) => {
  const todas = req.query.todas === 'true';
  const rows = db.prepare(`SELECT * FROM salas ${todas ? '' : 'WHERE ativo = 1'} ORDER BY ativo DESC, nome`).all();
  rows.forEach((r) => { r.ativo = Boolean(r.ativo); });
  res.json(rows);
};

exports.criar = (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  if (!nome) return erro(res, 400, 'Informe o nome da sala');
  if (db.prepare('SELECT id FROM salas WHERE lower(nome) = lower(?) AND ativo = 1').get(nome)) {
    return erro(res, 400, 'Já existe uma sala ativa com esse nome');
  }
  const r = db.prepare('INSERT INTO salas (nome, descricao) VALUES (?, ?)').run(nome, req.body?.descricao || null);
  const sala = db.prepare('SELECT * FROM salas WHERE id = ?').get(r.lastInsertRowid);
  sala.ativo = Boolean(sala.ativo);
  res.status(201).json(sala);
};

exports.atualizar = (req, res) => {
  const s = db.prepare('SELECT * FROM salas WHERE id = ?').get(req.params.id);
  if (!s) return erro(res, 404, 'Sala não encontrada');
  const nome = req.body?.nome !== undefined ? String(req.body.nome).trim() : s.nome;
  if (!nome) return erro(res, 400, 'Informe o nome da sala');
  const ativo = req.body?.ativo !== undefined ? (req.body.ativo ? 1 : 0) : s.ativo;
  db.prepare("UPDATE salas SET nome = ?, descricao = ?, ativo = ?, updatedAt = datetime('now') WHERE id = ?")
    .run(nome, req.body?.descricao !== undefined ? (req.body.descricao || null) : s.descricao, ativo, s.id);
  const sala = db.prepare('SELECT * FROM salas WHERE id = ?').get(s.id);
  sala.ativo = Boolean(sala.ativo);
  res.json(sala);
};

/** Desativa a sala (os agendamentos antigos continuam mostrando o nome dela). */
exports.excluir = (req, res) => {
  const s = db.prepare('SELECT id FROM salas WHERE id = ?').get(req.params.id);
  if (!s) return erro(res, 404, 'Sala não encontrada');
  db.prepare("UPDATE salas SET ativo = 0, updatedAt = datetime('now') WHERE id = ?").run(s.id);
  res.json({ mensagem: 'Sala desativada' });
};
