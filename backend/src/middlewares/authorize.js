const authorize = (...perfis) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({
        error: 'Acesso negado. Você não tem permissão para realizar esta ação.',
      });
    }

    next();
  };
};

module.exports = authorize;
