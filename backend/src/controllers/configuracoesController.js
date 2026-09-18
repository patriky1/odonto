const bcrypt = require('bcryptjs');
const db = require('../database/db');

const CHAVE_SENHA_FINANCEIRA = 'senha_financeira';
const SENHA_PADRAO = '123456';

const ler = (chave) => db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave)?.valor || null;

const gravar = (chave, valor, usuario) => {
  const existe = db.prepare('SELECT chave FROM configuracoes WHERE chave = ?').get(chave);
  if (existe) {
    db.prepare("UPDATE configuracoes SET valor=?, atualizadoPor=?, updatedAt=datetime('now') WHERE chave=?")
      .run(valor, usuario || null, chave);
  } else {
    db.prepare('INSERT INTO configuracoes (chave, valor, atualizadoPor) VALUES (?, ?, ?)')
      .run(chave, valor, usuario || null);
  }
};

/** Garante que exista uma senha financeira; na primeira vez cria a padrão. */
const garantirSenhaFinanceira = () => {
  let hash = ler(CHAVE_SENHA_FINANCEIRA);
  if (!hash) {
    hash = bcrypt.hashSync(SENHA_PADRAO, 10);
    gravar(CHAVE_SENHA_FINANCEIRA, hash, 'sistema');
    gravar('senha_financeira_padrao', 'sim', 'sistema');
    console.log(`🔒 Senha financeira criada com o valor padrão "${SENHA_PADRAO}" — altere em Configurações.`);
  }
  return hash;
};

/** Situação da proteção do financeiro (sem expor a senha). */
exports.statusFinanceiro = (req, res) => {
  garantirSenhaFinanceira();
  res.json({
    protegido: true,
    usandoSenhaPadrao: ler('senha_financeira_padrao') === 'sim',
    podeAlterar: req.usuario?.perfil === 'admin',
  });
};

/** Valida a senha e libera a exibição dos valores. */
exports.desbloquearFinanceiro = (req, res) => {
  try {
    const { senha } = req.body;
    if (!senha) return res.status(400).json({ erro: 'Informe a senha', error: 'Informe a senha' });

    const hash = garantirSenhaFinanceira();
    if (!bcrypt.compareSync(senha, hash)) {
      return res.status(401).json({ erro: 'Senha incorreta', error: 'Senha incorreta' });
    }

    res.json({
      liberado: true,
      usandoSenhaPadrao: ler('senha_financeira_padrao') === 'sim',
      // Token curto guardado só na sessão do navegador
      expiraEm: 30 * 60 * 1000,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Troca a senha financeira (somente admin). */
exports.alterarSenhaFinanceira = (req, res) => {
  try {
    if (req.usuario?.perfil !== 'admin') {
      return res.status(403).json({ erro: 'Apenas o administrador pode alterar a senha financeira', error: 'Apenas o administrador pode alterar a senha financeira' });
    }
    const { senhaAtual, novaSenha } = req.body;
    if (!novaSenha || novaSenha.length < 4) {
      return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 4 caracteres', error: 'A nova senha deve ter pelo menos 4 caracteres' });
    }

    const hash = garantirSenhaFinanceira();
    if (!bcrypt.compareSync(senhaAtual || '', hash)) {
      return res.status(400).json({ erro: 'Senha atual incorreta', error: 'Senha atual incorreta' });
    }
    if (novaSenha === SENHA_PADRAO) {
      return res.status(400).json({ erro: 'Escolha uma senha diferente da padrão', error: 'Escolha uma senha diferente da padrão' });
    }

    gravar(CHAVE_SENHA_FINANCEIRA, bcrypt.hashSync(novaSenha, 10), req.usuario.nome);
    gravar('senha_financeira_padrao', 'nao', req.usuario.nome);
    res.json({ mensagem: 'Senha financeira alterada com sucesso' });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/* ================================================================== *
 * DADOS DA EMPRESA (cabeçalho dos recibos e documentos impressos)
 * Guardados como JSON único na chave `dados_clinica`.
 * ================================================================== */

const CHAVE_CLINICA = 'dados_clinica';

const CLINICA_PADRAO = {
  razaoSocial: '',
  nomeFantasia: '',
  tipoDocumento: 'CNPJ',   // CNPJ ou CPF
  documento: '',
  cro: '',
  responsavel: '',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  telefone: '',
  email: '',
  site: '',
  logo: '',                // imagem em data URL (opcional)
  observacaoRecibo: '',    // texto fixo no rodapé do recibo
};

/** Dados da empresa já com todos os campos preenchidos (string vazia quando não houver). */
const lerClinica = () => {
  try {
    const bruto = ler(CHAVE_CLINICA);
    return { ...CLINICA_PADRAO, ...(bruto ? JSON.parse(bruto) : {}) };
  } catch {
    return { ...CLINICA_PADRAO };
  }
};

exports.dadosClinica = (req, res) => {
  res.json(lerClinica());
};

exports.salvarDadosClinica = (req, res) => {
  try {
    if (req.usuario?.perfil !== 'admin') {
      return res.status(403).json({ erro: 'Apenas o administrador pode alterar os dados da empresa', error: 'Apenas o administrador pode alterar os dados da empresa' });
    }

    const atual = lerClinica();
    const novo = { ...atual };
    // Só aceita os campos conhecidos — nada do corpo da requisição entra "solto"
    for (const campo of Object.keys(CLINICA_PADRAO)) {
      if (req.body?.[campo] !== undefined) novo[campo] = String(req.body[campo] ?? '').trim();
    }

    if (!novo.razaoSocial) {
      return res.status(400).json({ erro: 'Informe a razão social ou o nome da clínica', error: 'Informe a razão social ou o nome da clínica' });
    }
    if (novo.logo && novo.logo.length > 400_000) {
      return res.status(400).json({ erro: 'A logomarca é muito grande. Use uma imagem de até ~300 KB.', error: 'A logomarca é muito grande. Use uma imagem de até ~300 KB.' });
    }
    if (novo.tipoDocumento !== 'CPF') novo.tipoDocumento = 'CNPJ';

    gravar(CHAVE_CLINICA, JSON.stringify(novo), req.usuario.nome);
    res.json(novo);
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

module.exports.CHAVE_SENHA_FINANCEIRA = CHAVE_SENHA_FINANCEIRA;
module.exports.lerClinica = lerClinica;
module.exports.garantirSenhaFinanceira = garantirSenhaFinanceira;
module.exports.ler = ler;
