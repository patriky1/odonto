const bcrypt = require('bcryptjs');
const db = require('../database/db');

exports.listar = (req, res) => {
  const rows = db.prepare('SELECT id, nome, email, perfil, ativo, createdAt FROM usuarios ORDER BY nome').all();
  rows.forEach(r => r.ativo = Boolean(r.ativo));
  res.json(rows);
};

exports.criar = async (req, res) => {
  try {
    const { nome, email, senha, perfil = 'recepcionista', ativo = true } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });

    const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });

    const hash = await bcrypt.hash(senha, 10);
    const r = db.prepare("INSERT INTO usuarios (nome, email, senha, perfil, ativo) VALUES (?, ?, ?, ?, ?)").run(nome, email, hash, perfil, ativo ? 1 : 0);
    const novo = db.prepare('SELECT id, nome, email, perfil, ativo, createdAt FROM usuarios WHERE id = ?').get(r.lastInsertRowid);
    novo.ativo = Boolean(novo.ativo);
    res.status(201).json(novo);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, senha, perfil, ativo } = req.body;
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });

    if (email && email !== u.email) {
      const existe = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, id);
      if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    let hash = u.senha;
    if (senha && senha.length >= 6) {
      hash = await bcrypt.hash(senha, 10);
      // Senha definida pelo admin resolve os pedidos de "Esqueci minha senha" em aberto
      db.prepare("UPDATE redefinicoes_senha SET usadoEm = datetime('now') WHERE usuarioId = ? AND usadoEm IS NULL").run(id);
    }

    db.prepare("UPDATE usuarios SET nome=?, email=?, senha=?, perfil=?, ativo=?, updatedAt=datetime('now') WHERE id=?")
      .run(nome || u.nome, email || u.email, hash, perfil || u.perfil, ativo !== undefined ? (ativo ? 1 : 0) : u.ativo, id);

    const atualizado = db.prepare('SELECT id, nome, email, perfil, ativo, createdAt FROM usuarios WHERE id = ?').get(id);
    atualizado.ativo = Boolean(atualizado.ativo);
    res.json(atualizado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.excluir = (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.usuario.id) return res.status(400).json({ erro: 'Não é possível excluir sua própria conta' });
  const u = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
  db.prepare("UPDATE usuarios SET ativo = 0, updatedAt = datetime('now') WHERE id = ?").run(id);
  res.json({ mensagem: 'Usuário desativado' });
};

/**
 * Pedidos de "Esqueci minha senha" ainda não resolvidos (últimos 7 dias).
 * Aparecem para o admin na tela de Usuários — é o caminho de recuperação
 * quando o envio de e-mail não está configurado.
 */
exports.pedidosSenha = (req, res) => {
  const rows = db.prepare(`SELECT r.usuarioId, u.nome, u.email, MAX(r.createdAt) AS pedidoEm, MAX(r.emailEnviado) AS emailEnviado
                           FROM redefinicoes_senha r JOIN usuarios u ON u.id = r.usuarioId
                           WHERE r.usadoEm IS NULL AND u.ativo = 1 AND r.createdAt >= datetime('now', '-7 days')
                           GROUP BY r.usuarioId, u.nome, u.email ORDER BY pedidoEm DESC`).all();
  rows.forEach((r) => { r.emailEnviado = Boolean(r.emailEnviado); });
  res.json(rows);
};

/** Admin descarta um pedido de redefinição (ex.: a pessoa lembrou a senha). */
exports.descartarPedidoSenha = (req, res) => {
  db.prepare("UPDATE redefinicoes_senha SET usadoEm = datetime('now') WHERE usuarioId = ? AND usadoEm IS NULL").run(req.params.id);
  res.json({ mensagem: 'Pedido descartado' });
};
