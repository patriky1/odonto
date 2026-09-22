const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'odonto_secret_key_2024_very_secure';

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios' });

    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });
    if (!usuario.ativo) return res.status(401).json({ erro: 'Usuário inativo' });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const token = jwt.sign({ id: usuario.id, perfil: usuario.perfil }, JWT_SECRET, { expiresIn: '7d' });
    const { senha: _, ...u } = usuario;
    u.ativo = Boolean(u.ativo);
    res.json({ token, usuario: u });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.me = (req, res) => {
  const u = db.prepare('SELECT id, nome, email, perfil, ativo, createdAt FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (u) u.ativo = Boolean(u.ativo);
  res.json(u);
};

exports.alterarSenha = async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Campos obrigatórios' });
    if (novaSenha.length < 6) return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });

    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
    const valida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!valida) return res.status(400).json({ erro: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(novaSenha, 10);
    db.prepare("UPDATE usuarios SET senha = ?, updatedAt = datetime('now') WHERE id = ?").run(hash, req.usuario.id);
    res.json({ mensagem: 'Senha alterada com sucesso' });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

/* ================================================================== *
 * RECUPERAÇÃO DE SENHA ("Esqueci minha senha")
 *
 * 1. O usuário informa o e-mail no login.
 * 2. É gerado um link válido por 1 hora.
 *    - Com SMTP configurado no .env, o link vai por e-mail.
 *    - Sem SMTP, o pedido aparece para o administrador em Usuários,
 *      que define uma nova senha para a pessoa.
 * 3. A resposta é sempre a mesma, exista ou não o e-mail — assim
 *    ninguém descobre quais e-mails estão cadastrados.
 * ================================================================== */

const crypto = require('crypto');
const { enviarEmail } = require('../utils/email');

const VALIDADE_LINK_MS = 60 * 60 * 1000; // 1 hora
const escaparHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const MENSAGEM_PADRAO =
  'Se o e-mail estiver cadastrado, você receberá as instruções para criar uma nova senha. ' +
  'Caso não receba, procure o administrador do sistema — ele já foi avisado do seu pedido.';

/** Busca um pedido válido (não usado e não expirado) pelo token. */
const pedidoPeloToken = (token) => {
  if (!token) return null;
  const pedido = db.prepare(`SELECT r.*, u.nome, u.email, u.ativo FROM redefinicoes_senha r
                             JOIN usuarios u ON u.id = r.usuarioId
                             WHERE r.tokenHash = ? AND r.usadoEm IS NULL`).get(hashToken(token));
  if (!pedido || !pedido.ativo) return null;
  if (new Date(pedido.expiraEm).getTime() < Date.now()) return null;
  return pedido;
};

exports.esqueciSenha = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ erro: 'Informe o e-mail', error: 'Informe o e-mail' });

    const usuario = db.prepare('SELECT id, nome, email, ativo FROM usuarios WHERE lower(email) = lower(?)').get(email);
    if (!usuario || !usuario.ativo) return res.json({ mensagem: MENSAGEM_PADRAO });

    // Evita vários pedidos seguidos (spam) — 2 minutos entre um e outro
    const recente = db.prepare(`SELECT id FROM redefinicoes_senha WHERE usuarioId = ? AND usadoEm IS NULL
                                AND createdAt >= datetime('now', '-2 minutes')`).get(usuario.id);
    if (recente) return res.json({ mensagem: MENSAGEM_PADRAO });

    const token = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + VALIDADE_LINK_MS).toISOString();
    const r = db.prepare('INSERT INTO redefinicoes_senha (usuarioId, tokenHash, expiraEm) VALUES (?, ?, ?)')
      .run(usuario.id, hashToken(token), expiraEm);

    const base = (process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
    const link = `${base}/redefinir-senha?token=${token}`;

    const enviado = await enviarEmail({
      para: usuario.email,
      assunto: 'Redefinição de senha — Sistema Odontológico',
      texto: `Olá, ${usuario.nome}!\n\nRecebemos um pedido para redefinir a sua senha.\n` +
        `Acesse o link abaixo para criar uma nova senha (válido por 1 hora):\n\n${link}\n\n` +
        'Se você não fez este pedido, ignore este e-mail.',
      html: `<p>Olá, <strong>${escaparHtml(usuario.nome)}</strong>!</p>
        <p>Recebemos um pedido para redefinir a sua senha.</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#00959b;color:#fff;border-radius:8px;text-decoration:none">Criar nova senha</a></p>
        <p style="color:#64748b;font-size:13px">O link vale por 1 hora. Se você não fez este pedido, ignore este e-mail.</p>`,
    });

    if (enviado) db.prepare('UPDATE redefinicoes_senha SET emailEnviado = 1 WHERE id = ?').run(r.lastInsertRowid);
    else console.log(`🔑 Pedido de redefinição de senha de ${usuario.email} (sem e-mail configurado — veja em Usuários).`);

    res.json({ mensagem: MENSAGEM_PADRAO });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Confere se o link ainda é válido (usado pela tela de nova senha). */
exports.validarTokenRedefinicao = (req, res) => {
  const pedido = pedidoPeloToken(req.params.token);
  if (!pedido) return res.status(400).json({ erro: 'Link inválido ou expirado. Solicite um novo.', error: 'Link inválido ou expirado. Solicite um novo.' });
  res.json({ valido: true, nome: pedido.nome.split(' ')[0] });
};

exports.redefinirSenha = async (req, res) => {
  try {
    const { token, novaSenha } = req.body || {};
    if (!novaSenha || novaSenha.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres', error: 'A senha deve ter pelo menos 6 caracteres' });
    }
    const pedido = pedidoPeloToken(token);
    if (!pedido) return res.status(400).json({ erro: 'Link inválido ou expirado. Solicite um novo.', error: 'Link inválido ou expirado. Solicite um novo.' });

    const hash = await bcrypt.hash(novaSenha, 10);
    db.prepare("UPDATE usuarios SET senha = ?, updatedAt = datetime('now') WHERE id = ?").run(hash, pedido.usuarioId);
    // Invalida este e qualquer outro pedido aberto do mesmo usuário
    db.prepare("UPDATE redefinicoes_senha SET usadoEm = datetime('now') WHERE usuarioId = ? AND usadoEm IS NULL").run(pedido.usuarioId);

    res.json({ mensagem: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};
