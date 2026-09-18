const errorHandler = (err, req, res, next) => {
  console.error('Erro:', err);

  // Violação de UNIQUE do SQLite
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/i.test(err.message || '')) {
    return res.status(409).json({
      error: 'Registro duplicado. Este dado já existe no sistema.',
      erro: 'Registro duplicado. Este dado já existe no sistema.',
    });
  }

  // Violação de chave estrangeira
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY constraint failed/i.test(err.message || '')) {
    return res.status(409).json({
      error: 'Não é possível concluir: existem registros vinculados a este item.',
      erro: 'Não é possível concluir: existem registros vinculados a este item.',
    });
  }

  // JSON malformado no corpo da requisição
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido na requisição', erro: 'JSON inválido na requisição' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message || 'Erro interno do servidor';

  // Enviamos as duas chaves para manter compatibilidade com o frontend
  res.status(statusCode).json({ error: message, erro: message });
};

module.exports = errorHandler;
