/**
 * Backup pelo terminal — mesmas regras da tela de Configurações.
 *
 *   npm run backup                          cria um backup manual
 *   npm run backup:listar                   lista os backups existentes
 *   npm run backup:restaurar -- <arquivo>   restaura (pede confirmação)
 *
 * Pode ser usado com o servidor ligado ou desligado.
 */
const readline = require('readline');
const backup = require('../src/utils/backup');
const { registrarAuditoria } = require('../src/utils/auditoria');

// Autor dos registros de auditoria feitos pelo terminal
const TERMINAL = { usuario: { id: null, nome: 'Terminal (npm run backup)', perfil: null } };

const tamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR');

const perguntar = (texto) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let respondeu = false;
  rl.on('close', () => { if (!respondeu) resolve(''); }); // entrada fechada = cancelado
  rl.question(texto, (resposta) => { respondeu = true; rl.close(); resolve(resposta); });
});

const listar = () => {
  const lista = backup.listarBackups();
  console.log(`Pasta: ${backup.PASTA}\n`);
  if (!lista.length) { console.log('Nenhum backup encontrado.'); return; }
  lista.forEach((b) => console.log(`  ${b.arquivo.padEnd(48)} ${dataHora(b.criadoEm).padEnd(22)} ${tamanho(b.tamanho)}`));
};

const criar = () => {
  const novo = backup.criarBackup('manual');
  registrarAuditoria(TERMINAL, { entidade: 'backup', acao: 'criou', descricao: `Backup manual ${novo.arquivo}` });
  console.log(`✅ Backup criado: ${novo.arquivo} (${tamanho(novo.tamanho)})`);
  console.log(`   Pasta: ${backup.PASTA}`);
};

const restaurar = async (arquivo) => {
  if (!arquivo) {
    console.error('Informe o arquivo: npm run backup:restaurar -- <arquivo>\n');
    listar();
    process.exitCode = 1;
    return;
  }
  if (!backup.listarBackups().some((b) => b.arquivo === arquivo)) {
    throw new Error(`Backup não encontrado: ${arquivo}. Use "npm run backup:listar" para ver os nomes.`);
  }
  console.log(`⚠️  Todos os dados atuais serão substituídos pelos do backup "${arquivo}".`);
  console.log('   Um backup do estado atual (pre-restauracao) será criado antes.');
  const resposta = await perguntar('   Para confirmar, digite RESTAURAR: ');
  if (resposta.trim().toUpperCase() !== 'RESTAURAR') {
    console.log('Restauração cancelada. Nada foi alterado.');
    return;
  }
  const r = backup.restaurarBackup(arquivo);
  registrarAuditoria(TERMINAL, {
    entidade: 'backup',
    acao: 'restaurou',
    descricao: `Banco restaurado a partir de ${r.arquivoRestaurado} (estado anterior salvo em ${r.backupDeSeguranca})`,
  });
  console.log(`✅ Banco restaurado a partir de ${r.arquivoRestaurado}`);
  console.log(`   Estado anterior salvo em ${r.backupDeSeguranca}`);
  console.log('   Se o servidor estiver ligado, peça para os usuários entrarem novamente.');
};

const [comando = 'criar', arquivo] = process.argv.slice(2);

(async () => {
  try {
    if (comando === 'criar') criar();
    else if (comando === 'listar') listar();
    else if (comando === 'restaurar') await restaurar(arquivo);
    else {
      console.error(`Comando desconhecido: ${comando}. Use criar, listar ou restaurar <arquivo>.`);
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exitCode = 1;
  }
})();
