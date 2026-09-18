const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();

// Suppress experimental warning (node:sqlite is stable in Node.js v23+)
const _emitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  if (typeof warning === 'string' && warning.includes('SQLite')) return;
  _emitWarning(warning, ...args);
};

const dbPath = path.join(__dirname, '../../dev.db');
const db = new DatabaseSync(dbPath);

// WAL mode para performance
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'recepcionista',
    ativo INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE,
    dataNascimento TEXT,
    sexo TEXT,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    responsavel TEXT,
    observacoes TEXT,
    linkIdoc TEXT,
    cidadeAtendimento TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dentistas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cro TEXT UNIQUE,
    especialidade TEXT,
    telefone TEXT,
    email TEXT,
    diasAtendimento TEXT,
    horariosDisponiveis TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    usuarioId INTEGER REFERENCES usuarios(id),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS procedimentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor REAL NOT NULL DEFAULT 0,
    duracao INTEGER,
    ativo INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    dentistaId INTEGER NOT NULL REFERENCES dentistas(id),
    procedimentoId INTEGER REFERENCES procedimentos(id),
    data TEXT NOT NULL,
    horaInicio TEXT NOT NULL,
    horaFim TEXT,
    status TEXT NOT NULL DEFAULT 'agendado',
    observacoes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prontuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    dentistaId INTEGER REFERENCES dentistas(id),
    usuarioId INTEGER REFERENCES usuarios(id),
    queixaPrincipal TEXT,
    historico TEXT,
    diagnostico TEXT,
    observacoes TEXT,
    evolucao TEXT,
    procedimentos TEXT,
    medicamentos TEXT,
    anotacoes TEXT,
    data TEXT NOT NULL DEFAULT (datetime('now')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tratamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    valor REAL NOT NULL DEFAULT 0,
    sessoes INTEGER NOT NULL DEFAULT 1,
    sessoesRealizadas INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'nao_iniciado',
    dentistaId INTEGER REFERENCES dentistas(id),
    fotoAntes TEXT,
    fotoDepois TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS odontograma (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    numeroDente INTEGER NOT NULL,
    face TEXT,
    status TEXT,
    procedimento TEXT,
    observacoes TEXT,
    usuarioId INTEGER,
    dentistaId INTEGER,
    data TEXT NOT NULL DEFAULT (datetime('now')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    dentistaId INTEGER REFERENCES dentistas(id),
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    valorPago REAL NOT NULL DEFAULT 0,
    dataVencimento TEXT,
    dataPagamento TEXT,
    formaPagamento TEXT,
    parcelas INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pendente',
    observacoes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS receitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    data TEXT NOT NULL DEFAULT (datetime('now')),
    categoria TEXT,
    formaPagamento TEXT,
    origem TEXT,
    pacienteId INTEGER,
    usuarioId INTEGER,
    observacoes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT
  );

  -- Gastos da empresa (contas a pagar, custos fixos e variáveis)
  CREATE TABLE IF NOT EXISTS despesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    data TEXT NOT NULL DEFAULT (datetime('now')),
    categoria TEXT,
    fornecedor TEXT,
    formaPagamento TEXT,
    dataVencimento TEXT,
    status TEXT NOT NULL DEFAULT 'pago',
    recorrente INTEGER NOT NULL DEFAULT 0,
    frequencia TEXT,
    centroCusto TEXT,
    documento TEXT,
    parcelaAtual INTEGER,
    totalParcelas INTEGER,
    origemId INTEGER,
    usuarioId INTEGER,
    observacoes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS notificacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuarioId INTEGER REFERENCES usuarios(id),
    pacienteId INTEGER REFERENCES pacientes(id),
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    lida INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Ficha do odontograma: dados clínicos gerais do paciente (1 por paciente)
  CREATE TABLE IF NOT EXISTS odontograma_ficha (
    pacienteId INTEGER PRIMARY KEY REFERENCES pacientes(id),
    queixaPrincipal TEXT,
    anamnese TEXT,
    alertas TEXT,
    observacoesGerais TEXT,
    dentistaId INTEGER REFERENCES dentistas(id),
    atualizadoPor TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Histórico de alterações do odontograma (auditoria clínica)
  CREATE TABLE IF NOT EXISTS odontograma_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    numeroDente INTEGER NOT NULL,
    face TEXT,
    statusAnterior TEXT,
    statusNovo TEXT,
    procedimento TEXT,
    observacoes TEXT,
    usuarioId INTEGER,
    usuarioNome TEXT,
    acao TEXT NOT NULL DEFAULT 'atualizacao',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Anamnese odontológica: questionário clínico do paciente (1 por paciente)
  CREATE TABLE IF NOT EXISTS anamneses (
    pacienteId INTEGER PRIMARY KEY REFERENCES pacientes(id),
    respostas TEXT NOT NULL DEFAULT '{}',
    observacoes TEXT,
    dentistaId INTEGER REFERENCES dentistas(id),
    preenchidoPor TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Procedimentos ortodônticos realizados no paciente
  CREATE TABLE IF NOT EXISTS ortodontia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    dentistaId INTEGER REFERENCES dentistas(id),
    data TEXT NOT NULL DEFAULT (date('now')),
    tipoAparelho TEXT,
    procedimento TEXT NOT NULL,
    arcada TEXT,
    dentes TEXT,
    fioUtilizado TEXT,
    elasticos TEXT,
    forcaAplicada TEXT,
    queixas TEXT,
    orientacoes TEXT,
    proximaConsulta TEXT,
    valor REAL,
    observacoes TEXT,
    usuarioId INTEGER,
    usuarioNome TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Configurações gerais do sistema (chave/valor) — usada pela senha do financeiro
  CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT,
    atualizadoPor TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Salas / consultórios de atendimento (usadas na agenda)
  CREATE TABLE IF NOT EXISTS salas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Recibos entregues ao paciente (numeração sequencial por ano)
  CREATE TABLE IF NOT EXISTS recibos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    pacienteId INTEGER NOT NULL REFERENCES pacientes(id),
    pagamentoId INTEGER REFERENCES pagamentos(id),
    dentistaId INTEGER REFERENCES dentistas(id),
    valor REAL NOT NULL,
    descricao TEXT NOT NULL,
    dataPagamento TEXT NOT NULL,
    formaPagamento TEXT,
    pagadorNome TEXT NOT NULL,
    pagadorCpf TEXT,
    pagadorEndereco TEXT,
    observacoes TEXT,
    -- Cópia dos dados no momento da emissão (o papel impresso não pode mudar depois)
    empresa TEXT,
    paciente TEXT,
    profissional TEXT,
    usuarioId INTEGER,
    usuarioNome TEXT,
    cancelado INTEGER NOT NULL DEFAULT 0,
    canceladoEm TEXT,
    canceladoPor TEXT,
    motivoCancelamento TEXT,
    dataEmissao TEXT NOT NULL DEFAULT (datetime('now')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Pedidos de recuperação de senha ("Esqueci minha senha")
  CREATE TABLE IF NOT EXISTS redefinicoes_senha (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuarioId INTEGER NOT NULL REFERENCES usuarios(id),
    tokenHash TEXT NOT NULL,
    expiraEm TEXT NOT NULL,
    usadoEm TEXT,
    emailEnviado INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/* ------------------------------------------------------------------ *
 * MIGRAÇÕES INCREMENTAIS
 * Adiciona colunas novas em bancos já existentes sem perder dados.
 * ------------------------------------------------------------------ */
function garantirColunas(tabela, colunas) {
  let existentes;
  try {
    existentes = db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
  } catch {
    return;
  }
  for (const [nome, definicao] of Object.entries(colunas)) {
    if (!existentes.includes(nome)) {
      try {
        db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${nome} ${definicao}`);
        console.log(`🔧 Migração: coluna ${tabela}.${nome} adicionada`);
      } catch (e) {
        console.warn(`⚠️  Não foi possível adicionar ${tabela}.${nome}: ${e.message}`);
      }
    }
  }
}

// Controle completo de gastos da empresa
garantirColunas('despesas', {
  fornecedor: 'TEXT',
  formaPagamento: 'TEXT',
  dataVencimento: 'TEXT',
  status: "TEXT NOT NULL DEFAULT 'pago'",
  recorrente: 'INTEGER NOT NULL DEFAULT 0',
  frequencia: 'TEXT',
  centroCusto: 'TEXT',
  documento: 'TEXT',
  parcelaAtual: 'INTEGER',
  totalParcelas: 'INTEGER',
  origemId: 'INTEGER',
  usuarioId: 'INTEGER',
  updatedAt: 'TEXT',
});

garantirColunas('receitas', {
  formaPagamento: 'TEXT',
  origem: 'TEXT',
  pacienteId: 'INTEGER',
  usuarioId: 'INTEGER',
  updatedAt: 'TEXT',
});

// Face do dente e responsável pelo registro no odontograma
garantirColunas('odontograma', {
  usuarioId: 'INTEGER',
  dentistaId: 'INTEGER',
});

// Link do iDoc e cidade onde o paciente é atendido
garantirColunas('pacientes', {
  linkIdoc: 'TEXT',
  cidadeAtendimento: 'TEXT',
});

// Dentista responsável pelo pagamento
garantirColunas('pagamentos', {
  dentistaId: 'INTEGER',
});

// Fotos de antes e depois do tratamento
garantirColunas('tratamentos', {
  fotoAntes: 'TEXT',
  fotoDepois: 'TEXT',
  dentistaId: 'INTEGER',
});

// Foto de perfil do paciente
garantirColunas('pacientes', {
  foto: 'TEXT',
});

// Sala de atendimento e controle do lembrete por WhatsApp
garantirColunas('agendamentos', {
  salaId: 'INTEGER',
  lembreteEnviadoEm: 'TEXT',
});

/* ------------------------------------------------------------------ *
 * ÍNDICES — desempenho nas consultas mais usadas
 * ------------------------------------------------------------------ */
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_agendamentos_data       ON agendamentos(data);
  CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente   ON agendamentos(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_agendamentos_dentista   ON agendamentos(dentistaId);
  CREATE INDEX IF NOT EXISTS idx_pacientes_nome          ON pacientes(nome);
  CREATE INDEX IF NOT EXISTS idx_pacientes_cpf           ON pacientes(cpf);
  CREATE INDEX IF NOT EXISTS idx_prontuarios_paciente    ON prontuarios(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_tratamentos_paciente    ON tratamentos(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_pagamentos_paciente     ON pagamentos(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_pagamentos_status       ON pagamentos(status);
  CREATE INDEX IF NOT EXISTS idx_pagamentos_dataPgto     ON pagamentos(dataPagamento);
  CREATE INDEX IF NOT EXISTS idx_despesas_data           ON despesas(data);
  CREATE INDEX IF NOT EXISTS idx_despesas_categoria      ON despesas(categoria);
  CREATE INDEX IF NOT EXISTS idx_despesas_status         ON despesas(status);
  CREATE INDEX IF NOT EXISTS idx_receitas_data           ON receitas(data);
  CREATE INDEX IF NOT EXISTS idx_odontograma_paciente    ON odontograma(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_odonto_hist_paciente    ON odontograma_historico(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario    ON notificacoes(usuarioId);
  CREATE INDEX IF NOT EXISTS idx_dentistas_usuario       ON dentistas(usuarioId);
  CREATE INDEX IF NOT EXISTS idx_ortodontia_paciente     ON ortodontia(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_ortodontia_data         ON ortodontia(data);
  CREATE INDEX IF NOT EXISTS idx_pagamentos_dentista     ON pagamentos(dentistaId);
  CREATE INDEX IF NOT EXISTS idx_agendamentos_sala       ON agendamentos(salaId);
  CREATE INDEX IF NOT EXISTS idx_redef_senha_usuario     ON redefinicoes_senha(usuarioId);
  CREATE INDEX IF NOT EXISTS idx_recibos_paciente        ON recibos(pacienteId);
  CREATE INDEX IF NOT EXISTS idx_recibos_pagamento       ON recibos(pagamentoId);
  CREATE INDEX IF NOT EXISTS idx_recibos_emissao         ON recibos(dataEmissao);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_recibos_numero   ON recibos(ano, numero);
`);

/* ------------------------------------------------------------------ *
 * VÍNCULO DENTISTA ↔ USUÁRIO
 * Sem esse vínculo o sistema não consegue saber qual dentista está
 * logado (necessário para a agenda individual). Faz o casamento
 * automático por e-mail e, se não houver, por nome idêntico.
 * ------------------------------------------------------------------ */
try {
  const soltos = db.prepare('SELECT id, nome, email FROM dentistas WHERE usuarioId IS NULL').all();
  const vincular = db.prepare("UPDATE dentistas SET usuarioId = ?, updatedAt = datetime('now') WHERE id = ?");
  for (const d of soltos) {
    let u = d.email
      ? db.prepare("SELECT id FROM usuarios WHERE lower(email) = lower(?) AND perfil = 'dentista'").get(d.email)
      : null;
    if (!u) u = db.prepare("SELECT id FROM usuarios WHERE lower(nome) = lower(?) AND perfil = 'dentista'").get(d.nome);
    // Não vincula o mesmo usuário a dois dentistas
    if (u && !db.prepare('SELECT id FROM dentistas WHERE usuarioId = ?').get(u.id)) {
      vincular.run(u.id, d.id);
      console.log(`🔗 Dentista "${d.nome}" vinculado ao usuário #${u.id}`);
    }
  }
} catch (e) {
  console.warn('⚠️  Não foi possível vincular dentistas a usuários:', e.message);
}

// Um registro por dente+face de cada paciente (evita duplicidade no odontograma)
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_odontograma_unico
           ON odontograma(pacienteId, numeroDente, IFNULL(face, '-'))`);
} catch (e) {
  console.warn('⚠️  Índice único do odontograma não criado (existem registros duplicados):', e.message);
}

module.exports = db;
