const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const pacientesRoutes = require('./routes/pacientes');
const dentistasRoutes = require('./routes/dentistas');
const agendamentosRoutes = require('./routes/agendamentos');
const tratamentosRoutes = require('./routes/tratamentos');
const procedimentosRoutes = require('./routes/procedimentos');
const prontuariosRoutes = require('./routes/prontuarios');
const odontogramaRoutes = require('./routes/odontograma');
const financeiroRoutes = require('./routes/financeiro');
const notificacoesRoutes = require('./routes/notificacoes');
const usuariosRoutes = require('./routes/usuarios');
const dashboardRoutes = require('./routes/dashboard');
const anamneseRoutes = require('./routes/anamnese');
const ortodontiaRoutes = require('./routes/ortodontia');
const configuracoesRoutes = require('./routes/configuracoes');
const uploadRoutes = require('./routes/upload');
const salasRoutes = require('./routes/salas');
const recibosRoutes = require('./routes/recibos');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Limite maior: as fotos de tratamento chegam como data URL em JSON
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Imagens enviadas (fotos de antes/depois dos tratamentos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { maxAge: '7d' }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/dentistas', dentistasRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/tratamentos', tratamentosRoutes);
app.use('/api/procedimentos', procedimentosRoutes);
app.use('/api/prontuarios', prontuariosRoutes);
app.use('/api/odontograma', odontogramaRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/anamnese', anamneseRoutes);
app.use('/api/ortodontia', ortodontiaRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/salas', salasRoutes);
app.use('/api/recibos', recibosRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sistema Odontológico API funcionando!' });
});

// Error handler
app.use(errorHandler);

module.exports = app;
