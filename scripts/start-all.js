/**
 * Sobe o ambiente inteiro com um comando:  npm run start:all
 *
 *  1. Confere a versão do Node (o banco usa node:sqlite → Node 22.5+).
 *  2. Instala as dependências do backend/frontend se ainda não existirem.
 *  3. Inicia `npm run dev` do backend (API + backup automático) e do
 *     frontend (Vite), com a saída de cada um identificada.
 *  Ctrl+C encerra os dois. Se um deles cair, o outro também é encerrado.
 *
 * Nunca roda o seed (ele APAGA todos os dados do banco).
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const WINDOWS = process.platform === 'win32';
const RESET = '\x1b[0m';

const SERVICOS = [
  { nome: 'backend', pasta: path.join(RAIZ, 'backend'), cor: '\x1b[36m' },
  { nome: 'frontend', pasta: path.join(RAIZ, 'frontend'), cor: '\x1b[35m' },
];

const log = (msg) => console.log(`\x1b[1m[start:all]${RESET} ${msg}`);

// 1. Node
const [maior, menor] = process.versions.node.split('.').map(Number);
if (maior < 22 || (maior === 22 && menor < 5)) {
  log(`Node ${process.versions.node} encontrado — é necessário o Node 22.5 ou mais novo (https://nodejs.org).`);
  process.exit(1);
}

// 2. Dependências e configuração
for (const s of SERVICOS) {
  if (!fs.existsSync(path.join(s.pasta, 'node_modules'))) {
    log(`Instalando dependências do ${s.nome}...`);
    const r = spawnSync('npm install', { cwd: s.pasta, stdio: 'inherit', shell: true });
    if (r.status !== 0) { log(`Falha ao instalar as dependências do ${s.nome}.`); process.exit(r.status || 1); }
  }
}
if (!fs.existsSync(path.join(RAIZ, 'backend', '.env'))) {
  log('⚠️  backend/.env não encontrado. Copie backend/.env.example para backend/.env e ajuste os valores (principalmente JWT_SECRET).');
}

// 3. Serviços
const processos = [];
let encerrando = false;

const prefixar = (s, fluxo, destino) => {
  let resto = '';
  fluxo.on('data', (pedaco) => {
    const linhas = (resto + pedaco.toString()).split(/\r?\n/);
    resto = linhas.pop();
    linhas.forEach((l) => destino.write(`${s.cor}[${s.nome}]${RESET} ${l}\n`));
  });
  fluxo.on('end', () => { if (resto) destino.write(`${s.cor}[${s.nome}]${RESET} ${resto}\n`); });
};

const parar = (p) => {
  if (p.exitCode !== null || p.signalCode !== null) return;
  if (WINDOWS) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-p.pid, 'SIGTERM'); } catch { p.kill('SIGTERM'); } }
};

const encerrar = (codigo) => {
  if (encerrando) return;
  encerrando = true;
  log('Encerrando os serviços...');
  processos.forEach(parar);
  setTimeout(() => process.exit(codigo), 500);
};

for (const s of SERVICOS) {
  const p = spawn('npm run dev', {
    cwd: s.pasta,
    shell: true,
    detached: !WINDOWS, // permite encerrar a árvore inteira no Linux/macOS
  });
  prefixar(s, p.stdout, process.stdout);
  prefixar(s, p.stderr, process.stderr);
  p.on('exit', (codigo) => {
    if (encerrando) return;
    log(`O ${s.nome} parou (código ${codigo}). Encerrando o restante.`);
    encerrar(1);
  });
  processos.push(p);
}

log('Backend (API) em http://localhost:3001/api  |  Sistema em http://localhost:5173');
log('Pressione Ctrl+C para encerrar.');

process.on('SIGINT', () => encerrar(0));
process.on('SIGTERM', () => encerrar(0));
