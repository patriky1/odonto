const jwt = require('jsonwebtoken');
const db = require('../database/db');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'odonto_secret_key_2024_very_secure');

    const usuario = db.prepare('SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?').get(decoded.id);
    if (!usuario) return res.status(401).json({ error: 'Usuário não encontrado' });
    if (!usuario.ativo) return res.status(401).json({ error: 'Conta desativada' });

    usuario.ativo = Boolean(usuario.ativo);
    req.usuario = usuario;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Token inválido' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado' });
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = authMiddleware;
