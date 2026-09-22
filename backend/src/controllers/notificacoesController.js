const db = require('../database/db');

exports.listar = (req, res) => {
  const rows = db.prepare("SELECT * FROM notificacoes WHERE usuarioId = ? OR usuarioId IS NULL ORDER BY createdAt DESC LIMIT 50").all(req.usuario.id);
  rows.forEach(r => r.lida = Boolean(r.lida));
  res.json(rows);
};

exports.naoLidas = (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as c FROM notificacoes WHERE (usuarioId = ? OR usuarioId IS NULL) AND lida = 0").get(req.usuario.id).c;
  res.json({ count });
};

exports.marcarLida = (req, res) => {
  db.prepare("UPDATE notificacoes SET lida = 1 WHERE id = ?").run(req.params.id);
  res.json({ mensagem: 'Marcada como lida' });
};

exports.marcarTodasLidas = (req, res) => {
  db.prepare("UPDATE notificacoes SET lida = 1 WHERE usuarioId = ? OR usuarioId IS NULL").run(req.usuario.id);
  res.json({ mensagem: 'Todas marcadas como lidas' });
};
