const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { ler, gravar } = require('../controllers/configuracoesController');

/**
 * BACKUP DO BANCO (SQLite)
 *
 * - Criar: `VACUUM INTO` gera uma cópia consistente do banco mesmo com o
 *   sistema em uso (inclui o que ainda está no arquivo -wal).
 * - Restaurar: o servidor mantém UMA conexão aberta com o dev.db, então o
 *   arquivo não pode ser trocado com ele rodando. Em vez disso, o backup é
 *   anexado (ATTACH) e os dados são copiados para o banco atual dentro de
 *   uma transação: se qualquer passo falhar, nada muda. Antes disso é
 *   sempre criado um backup "pre-restauracao" do estado atual.
 * - Tudo aqui é síncrono (node:sqlite): nenhuma requisição intercala no meio.
 */

const PASTA = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(__dirname, '../../backups');

const TIPOS = ['manual', 'automatico', 'pre-restauracao'];
const PADRAO_NOME = /^odonto-(manual|automatico|pre-restauracao)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-\d+)?\.db$/;

// Frequências oferecidas na tela (0 = desativado)
const INTERVALOS_HORAS = [0, 6, 12, 24, 168];
const CHAVE_INTERVALO = 'backup_intervalo_horas';
const CHAVE_MANTER = 'backup_manter_automaticos';
const VERIFICAR_A_CADA_MS = 10 * 60 * 1000;

const erro = (mensagem, statusCode = 400) => Object.assign(new Error(mensagem), { statusCode });

const doisDig = (n) => String(n).padStart(2, '0');
const carimbo = (d = new Date()) =>
  `${d.getFullYear()}${doisDig(d.getMonth() + 1)}${doisDig(d.getDate())}-${doisDig(d.getHours())}${doisDig(d.getMinutes())}${doisDig(d.getSeconds())}`;

/** Caminho completo de um backup — só aceita nomes no padrão (bloqueia "../" e afins). */
const caminhoDoBackup = (arquivo) => {
  if (typeof arquivo !== 'string' || path.basename(arquivo) !== arquivo || !PADRAO_NOME.test(arquivo)) {
    throw erro('Nome de arquivo de backup inválido');
  }
  return path.join(PASTA, arquivo);
};

/** Data/hora vem do nome do arquivo (não muda se a pasta for copiada). */
const infoDoArquivo = (arquivo) => {
  const m = arquivo.match(PADRAO_NOME);
  const st = fs.statSync(path.join(PASTA, arquivo));
  const [, tipo, ano, mes, dia, h, min, s] = m;
  const criadoEm = new Date(+ano, +mes - 1, +dia, +h, +min, +s);
  return {
    arquivo,
    tipo,
    tamanho: st.size,
    criadoEm: (Number.isNaN(criadoEm.getTime()) ? st.mtime : criadoEm).toISOString(),
  };
};

const listarBackups = () => {
  if (!fs.existsSync(PASTA)) return [];
  return fs.readdirSync(PASTA)
    .filter((f) => PADRAO_NOME.test(f))
    .map(infoDoArquivo)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.arquivo.localeCompare(a.arquivo));
};

const criarBackup = (tipo = 'manual') => {
  if (!TIPOS.includes(tipo)) throw erro('Tipo de backup inválido');
  fs.mkdirSync(PASTA, { recursive: true });

  const base = `odonto-${tipo}-${carimbo()}`;
  let arquivo = `${base}.db`;
  for (let n = 1; fs.existsSync(path.join(PASTA, arquivo)); n++) arquivo = `${base}-${n}.db`;
  const destino = path.join(PASTA, arquivo);

  try {
    db.prepare('VACUUM main INTO ?').run(destino);
  } catch (e) {
    try { fs.unlinkSync(destino); } catch { /* não chegou a ser criado */ }
    throw erro(`Não foi possível criar o backup: ${e.message}`, 500);
  }
  return infoDoArquivo(arquivo);
};

const excluirBackup = (arquivo) => {
  const caminho = caminhoDoBackup(arquivo);
  if (!fs.existsSync(caminho)) throw erro('Backup não encontrado', 404);
  fs.unlinkSync(caminho);
};

const tabelasDe = (schema) =>
  db.prepare(`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all().map((t) => t.name);

const anexar = (origem) => {
  try {
    db.prepare('ATTACH DATABASE ? AS bkp').run(origem);
  } catch (e) {
    throw erro(`O arquivo não é um backup válido (${e.message})`);
  }
};

const colunasDe = (schema, tabela) =>
  db.prepare(`PRAGMA ${schema}.table_info("${tabela}")`).all().map((c) => c.name);

/** Confere se o arquivo anexado como `bkp` é um backup íntegro deste sistema. */
const validarAnexado = () => {
  let tabelas;
  try {
    const integridade = db.prepare('PRAGMA bkp.integrity_check').all();
    if (integridade.length !== 1 || Object.values(integridade[0])[0] !== 'ok') {
      throw erro('O arquivo de backup está corrompido. Escolha outro backup.');
    }
    tabelas = new Set(tabelasDe('bkp'));
  } catch (e) {
    if (e.statusCode) throw e;
    throw erro(`O arquivo não é um backup válido (${e.message})`);
  }
  if (!tabelas.has('usuarios') || !tabelas.has('pacientes')) {
    throw erro('O arquivo não parece ser um backup deste sistema');
  }
  const admins = db.prepare("SELECT COUNT(*) AS n FROM bkp.usuarios WHERE perfil = 'admin' AND ativo = 1").get();
  if (!admins.n) {
    throw erro('O backup não tem nenhum administrador ativo — restaurá-lo bloquearia o acesso ao sistema');
  }
  return tabelas;
};

/**
 * Substitui os dados do banco atual pelos do backup.
 * Tabelas/colunas que não existiam na época do backup ficam vazias/com o padrão.
 */
const restaurarBackup = (arquivo) => {
  const origem = caminhoDoBackup(arquivo);
  if (!fs.existsSync(origem)) throw erro('Backup não encontrado', 404);

  // 1. Valida antes de mexer em qualquer coisa
  anexar(origem);
  try {
    validarAnexado();
  } finally {
    db.exec('DETACH DATABASE bkp');
  }

  // 2. Cópia de segurança do estado atual (sem ela, não restaura)
  const seguranca = criarBackup('pre-restauracao');

  // 3. Copia os dados numa única transação
  anexar(origem);
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    const tabelasBkp = new Set(tabelasDe('bkp'));
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const tabela of tabelasDe('main')) {
        db.exec(`DELETE FROM main."${tabela}"`);
        if (!tabelasBkp.has(tabela)) continue;
        const doBackup = new Set(colunasDe('bkp', tabela));
        const comuns = colunasDe('main', tabela).filter((c) => doBackup.has(c)).map((c) => `"${c}"`).join(', ');
        if (comuns) db.exec(`INSERT INTO main."${tabela}" (${comuns}) SELECT ${comuns} FROM bkp."${tabela}"`);
      }
      // Contadores de AUTOINCREMENT iguais aos do backup
      const temSequencia = db.prepare("SELECT 1 FROM bkp.sqlite_master WHERE name = 'sqlite_sequence'").get();
      if (temSequencia) {
        db.exec('DELETE FROM main.sqlite_sequence');
        db.exec('INSERT INTO main.sqlite_sequence (name, seq) SELECT name, seq FROM bkp.sqlite_sequence');
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw erro(`A restauração foi cancelada e o banco atual não foi alterado (${e.message})`, 500);
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
    try { db.exec('DETACH DATABASE bkp'); } catch { /* já desanexado */ }
  }

  return { arquivoRestaurado: arquivo, backupDeSeguranca: seguranca.arquivo };
};

/* ------------------------------------------------------------------ *
 * BACKUP AUTOMÁTICO
 * ------------------------------------------------------------------ */

const numero = (valor, padrao) => {
  if (valor === null || valor === undefined || valor === '') return padrao;
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
};

const configBackup = () => ({
  intervaloHoras: numero(ler(CHAVE_INTERVALO), numero(process.env.BACKUP_INTERVALO_HORAS, 24)),
  manter: numero(ler(CHAVE_MANTER), numero(process.env.BACKUP_MANTER, 14)),
});

const salvarConfigBackup = ({ intervaloHoras, manter }, usuarioNome) => {
  const intervalo = Number(intervaloHoras);
  const qtd = Number(manter);
  if (!INTERVALOS_HORAS.includes(intervalo)) throw erro('Frequência de backup inválida');
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 100) throw erro('Informe quantos backups automáticos manter (de 1 a 100)');
  gravar(CHAVE_INTERVALO, String(intervalo), usuarioNome);
  gravar(CHAVE_MANTER, String(qtd), usuarioNome);
  return configBackup();
};

const ultimoAutomatico = () => listarBackups().find((b) => b.tipo === 'automatico') || null;

/** Quando o próximo backup automático deve acontecer (null = desativado). */
const proximoAutomatico = () => {
  const { intervaloHoras } = configBackup();
  if (!intervaloHoras) return null;
  const ultimo = ultimoAutomatico();
  if (!ultimo) return new Date().toISOString();
  return new Date(new Date(ultimo.criadoEm).getTime() + intervaloHoras * 3600 * 1000).toISOString();
};

/** Mantém só os N backups automáticos mais recentes (manuais nunca são apagados aqui). */
const aplicarRetencao = (manter) => {
  listarBackups().filter((b) => b.tipo === 'automatico').slice(manter).forEach((b) => {
    try { fs.unlinkSync(path.join(PASTA, b.arquivo)); } catch (e) {
      console.warn(`⚠️  Não foi possível apagar o backup antigo ${b.arquivo}:`, e.message);
    }
  });
};

const executarBackupAutomaticoSeDevido = () => {
  try {
    const { intervaloHoras, manter } = configBackup();
    if (!intervaloHoras) return null;
    const ultimo = ultimoAutomatico();
    if (ultimo && Date.now() - new Date(ultimo.criadoEm).getTime() < intervaloHoras * 3600 * 1000) return null;
    const novo = criarBackup('automatico');
    aplicarRetencao(manter);
    console.log(`💾 Backup automático criado: ${novo.arquivo}`);
    return novo;
  } catch (e) {
    console.warn('⚠️  Falha no backup automático:', e.message);
    return null;
  }
};

let timer = null;

/** Liga a rotina (chamado pelo server.js). Verifica periodicamente se já está na hora. */
const iniciarBackupAutomatico = () => {
  if (timer) return;
  const { intervaloHoras } = configBackup();
  console.log(intervaloHoras
    ? `💾 Backup automático a cada ${intervaloHoras}h — pasta: ${PASTA}`
    : '💾 Backup automático desativado (ative em Configurações)');
  setTimeout(executarBackupAutomaticoSeDevido, 30 * 1000).unref();
  timer = setInterval(executarBackupAutomaticoSeDevido, VERIFICAR_A_CADA_MS);
  timer.unref();
};

module.exports = {
  PASTA,
  INTERVALOS_HORAS,
  listarBackups,
  criarBackup,
  excluirBackup,
  restaurarBackup,
  configBackup,
  salvarConfigBackup,
  ultimoAutomatico,
  proximoAutomatico,
  executarBackupAutomaticoSeDevido,
  iniciarBackupAutomatico,
};
