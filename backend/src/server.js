const app = require('./app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🦷 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API disponível em http://localhost:${PORT}/api`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
