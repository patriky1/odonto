const db = require('../database/db');
const { salvarDataUrl, removerArquivo } = require('./uploadController');
const { lerClinica } = require('./configuracoesController');
const { hojeISO } = require('../utils/datas');
const { autor, registrarAuditoria } = require('../utils/auditoria');

/* ================================================================== *
 * MODELOS DE TERMO
 * Textos-base: a clínica deve revisá-los com o seu jurídico/CRO antes
 * de usar. Os campos entre chaves são preenchidos automaticamente e o
 * texto final continua editável até a assinatura.
 * ================================================================== */

const ABERTURA = 'Eu, {paciente}{cpf}{responsavel}, declaro que fui atendido(a) na {clinica} pelo(a) profissional {dentista}{cro}';

const ENCERRAMENTO = `Declaro que li (ou que este termo foi lido para mim), que tive a oportunidade de fazer perguntas, que todas foram respondidas de forma clara e que as informações acima foram compreendidas. Estou ciente de que posso revogar este consentimento a qualquer momento, antes da realização do procedimento, sem qualquer prejuízo ao meu atendimento.

Autorizo também o registro das informações deste atendimento em prontuário, que será mantido sob sigilo profissional, conforme o Código de Ética Odontológica e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

{cidade}{data}.`;

const MODELOS = [
  {
    id: 'geral',
    titulo: 'Termo de Consentimento Livre e Esclarecido — Tratamento Odontológico',
    procedimentoPadrao: 'Tratamento odontológico conforme plano apresentado',
    corpo: `${ABERTURA}, e que recebi explicações claras sobre o diagnóstico e o plano de tratamento proposto: {procedimento}.

Fui informado(a) sobre os objetivos, os benefícios esperados, as alternativas de tratamento disponíveis, o tempo estimado, os custos e os riscos e desconfortos que podem ocorrer, como sensibilidade, dor, inchaço, sangramento, hematomas e reações ao anestésico local.

Estou ciente de que a Odontologia não é uma ciência exata e que os resultados dependem também da resposta do meu organismo e da minha colaboração, seguindo as orientações recebidas, comparecendo às consultas agendadas e mantendo a higiene bucal adequada.

Comprometo-me a informar ao profissional qualquer alteração no meu estado de saúde, uso de medicamentos, alergias, gravidez ou outras condições relevantes.

Assim, AUTORIZO a realização do tratamento descrito.

${ENCERRAMENTO}`,
  },
  {
    id: 'cirurgia',
    titulo: 'Termo de Consentimento — Cirurgia / Extração Dentária',
    procedimentoPadrao: 'Exodontia (extração dentária)',
    corpo: `${ABERTURA}, e que fui esclarecido(a) sobre a necessidade de realizar o seguinte procedimento cirúrgico: {procedimento}.

Recebi explicações sobre os riscos e possíveis complicações, que incluem: dor, inchaço e limitação de abertura da boca nos dias seguintes; sangramento; hematomas; infecção; alveolite; comunicação buco-sinusal (em dentes superiores); fratura de raiz ou do osso; e alteração temporária ou, raramente, permanente da sensibilidade de lábio, língua ou queixo.

Fui orientado(a) sobre os cuidados pós-operatórios (repouso, alimentação, higiene, medicação prescrita e retorno) e me comprometo a segui-los. Informei ao profissional todas as doenças, medicamentos em uso (especialmente anticoagulantes) e alergias de que tenho conhecimento.

Autorizo o uso de anestesia local e de medicação necessária, bem como mudanças no procedimento que se mostrem indispensáveis durante a cirurgia para a minha segurança.

${ENCERRAMENTO}`,
  },
  {
    id: 'endodontia',
    titulo: 'Termo de Consentimento — Tratamento de Canal (Endodontia)',
    procedimentoPadrao: 'Tratamento endodôntico (canal)',
    corpo: `${ABERTURA}, e que fui esclarecido(a) sobre a indicação de tratamento endodôntico: {procedimento}.

Fui informado(a) de que o tratamento pode exigir mais de uma sessão, que pode haver dor ou sensibilidade entre as sessões e após a conclusão, e que existem riscos como fratura de instrumento dentro do canal, perfuração, dificuldade de acesso por canais calcificados ou curvos, e insucesso do tratamento, podendo ser necessário retratamento, cirurgia complementar ou extração.

Estou ciente de que, após o canal, o dente fica mais frágil e precisará de restauração definitiva ou prótese em prazo adequado, e que a demora nessa etapa aumenta o risco de fratura e de reinfecção.

${ENCERRAMENTO}`,
  },
  {
    id: 'ortodontia',
    titulo: 'Termo de Consentimento — Tratamento Ortodôntico',
    procedimentoPadrao: 'Tratamento ortodôntico com aparelho',
    corpo: `${ABERTURA}, e que recebi explicações sobre o tratamento ortodôntico proposto: {procedimento}.

Fui informado(a) de que o tempo de tratamento é uma estimativa e depende da resposta biológica e da minha colaboração (uso de elásticos e aparelhos, higiene e comparecimento às manutenções). Faltas, quebras frequentes do aparelho e má higiene prolongam o tratamento e podem comprometer o resultado.

Estou ciente dos riscos possíveis: desconforto nos primeiros dias após as ativações, feridas na boca, manchas brancas ou cáries por higiene deficiente, reabsorção das raízes, alterações na articulação (ATM) e recidiva (retorno parcial dos dentes à posição anterior), razão pela qual o uso da contenção após o tratamento é indispensável.

${ENCERRAMENTO}`,
  },
  {
    id: 'implante',
    titulo: 'Termo de Consentimento — Implante Dentário',
    procedimentoPadrao: 'Instalação de implante dentário',
    corpo: `${ABERTURA}, e que fui esclarecido(a) sobre o procedimento de implante dentário: {procedimento}.

Fui informado(a) de que o sucesso do implante depende da integração com o osso (osseointegração), que pode não ocorrer mesmo com a técnica correta, e que fatores como tabagismo, diabetes não controlada, bruxismo e higiene deficiente aumentam o risco de perda do implante. Podem ser necessários enxertos ósseos e prazos de espera entre as etapas.

Estou ciente dos riscos cirúrgicos, entre eles dor, inchaço, sangramento, infecção, alteração de sensibilidade em lábio, língua ou queixo e, em implantes superiores, comunicação com o seio maxilar.

Comprometo-me a seguir as orientações pós-operatórias e a comparecer às consultas de controle e manutenção.

${ENCERRAMENTO}`,
  },
  {
    id: 'clareamento',
    titulo: 'Termo de Consentimento — Clareamento Dental',
    procedimentoPadrao: 'Clareamento dental',
    corpo: `${ABERTURA}, e que fui esclarecido(a) sobre o clareamento dental: {procedimento}.

Fui informado(a) de que o resultado varia de pessoa para pessoa, que restaurações, coroas e facetas não mudam de cor e podem precisar ser substituídas para harmonizar o sorriso, e que a cor obtida não é permanente, podendo exigir sessões de manutenção.

Estou ciente de que podem ocorrer sensibilidade dental e irritação da gengiva durante e após o tratamento, geralmente passageiras, e me comprometo a seguir as orientações de uso do produto e de alimentação no período indicado.

${ENCERRAMENTO}`,
  },
  {
    id: 'imagem',
    titulo: 'Autorização de Uso de Imagem',
    procedimentoPadrao: 'Registro fotográfico e radiográfico do tratamento',
    corpo: `Eu, {paciente}{cpf}{responsavel}, AUTORIZO a {clinica} e o(a) profissional {dentista}{cro} a realizar registros fotográficos, radiográficos e em vídeo relacionados ao meu tratamento ({procedimento}).

As imagens poderão ser usadas para fins de documentação clínica em prontuário e, desde que sem identificação do meu rosto completo ou do meu nome, para fins didáticos, científicos e de divulgação dos serviços da clínica, respeitando o Código de Ética Odontológica.

Esta autorização é gratuita e pode ser revogada a qualquer momento, mediante solicitação por escrito, sem efeito sobre publicações já realizadas antes da revogação.

{cidade}{data}.`,
  },
  {
    id: 'personalizado',
    titulo: 'Termo de Autorização',
    procedimentoPadrao: '',
    corpo: `Eu, {paciente}{cpf}{responsavel}, declaro que AUTORIZO...

{cidade}{data}.`,
  },
];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const dataPorExtenso = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};

const formatarCPF = (cpf) => {
  const d = String(cpf || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (cpf || '');
};

/** " (CRO-PB 1234)" — não repete o prefixo quando o cadastro já traz "CRO". */
const rotuloCro = (cro) => {
  const v = String(cro || '').trim();
  if (!v) return '';
  return /^cro/i.test(v) ? ` (${v})` : ` (CRO ${v})`;
};

/** Substitui os campos {chave} do modelo pelos dados reais. */
const preencher = (texto, { paciente, dentista, procedimento, clinica }) => {
  const campos = {
    paciente: paciente?.nome || '________________________',
    cpf: paciente?.cpf ? `, CPF ${formatarCPF(paciente.cpf)}` : '',
    responsavel: paciente?.responsavel ? `, neste ato representado(a) por ${paciente.responsavel}` : '',
    clinica: clinica?.nomeFantasia || clinica?.razaoSocial || 'clínica',
    dentista: dentista?.nome || clinica?.responsavel || '________________________',
    cro: rotuloCro(dentista?.cro || clinica?.cro),
    procedimento: procedimento || '________________________',
    cidade: clinica?.cidade ? `${clinica.cidade}${clinica.estado ? `/${clinica.estado}` : ''}, ` : '',
    data: dataPorExtenso(hojeISO()),
  };
  return texto.replace(/\{(\w+)\}/g, (m, chave) => (chave in campos ? campos[chave] : m));
};

const SELECT_TERMO = `SELECT t.*, d.nome AS dentistaNome, d.cro AS dentistaCro, p.nome AS pacienteNome
  FROM termos_consentimento t
  LEFT JOIN dentistas d ON t.dentistaId = d.id
  LEFT JOIN pacientes p ON t.pacienteId = p.id`;

const buscar = (id) => db.prepare(`${SELECT_TERMO} WHERE t.id = ?`).get(id);

const erro = (res, status, msg) => res.status(status).json({ erro: msg, error: msg });

const auditar = (req, acao, t, extra = '') => registrarAuditoria(req, {
  entidade: 'termo', entidadeId: t?.id, acao,
  descricao: `${t?.titulo || 'Termo'} — ${t?.pacienteNome || `Paciente #${t?.pacienteId}`}${extra ? ` (${extra})` : ''}`,
  pacienteId: t?.pacienteId, dentistaId: t?.dentistaId,
});

/* ================================================================== *
 * ENDPOINTS
 * ================================================================== */

exports.modelos = (req, res) => {
  res.json(MODELOS.map(({ id, titulo, procedimentoPadrao }) => ({ id, titulo, procedimentoPadrao })));
};

/** Pré-visualização do texto preenchido, antes de salvar. */
exports.previa = (req, res) => {
  const { modelo = 'geral', pacienteId, dentistaId, procedimento } = req.body || {};
  const m = MODELOS.find((x) => x.id === modelo);
  if (!m) return erro(res, 400, 'Modelo de termo não encontrado');
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(pacienteId);
  if (!paciente) return erro(res, 404, 'Paciente não encontrado');
  const dentista = dentistaId ? db.prepare('SELECT * FROM dentistas WHERE id = ?').get(dentistaId) : null;
  res.json({
    titulo: m.titulo,
    conteudo: preencher(m.corpo, { paciente, dentista, procedimento: procedimento || m.procedimentoPadrao, clinica: lerClinica() }),
  });
};

exports.listarPorPaciente = (req, res) => {
  const termos = db.prepare(`${SELECT_TERMO} WHERE t.pacienteId = ? ORDER BY t.createdAt DESC, t.id DESC`)
    .all(req.params.pacienteId);
  res.json(termos);
};

exports.buscarPorId = (req, res) => {
  const t = buscar(req.params.id);
  if (!t) return erro(res, 404, 'Termo não encontrado');
  res.json(t);
};

exports.criar = (req, res) => {
  try {
    const { pacienteId, dentistaId, modelo = 'geral', procedimento } = req.body;
    let { titulo, conteudo } = req.body;

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ? AND ativo = 1').get(pacienteId);
    if (!paciente) return erro(res, 404, 'Paciente não encontrado');
    const dentista = dentistaId ? db.prepare('SELECT * FROM dentistas WHERE id = ?').get(dentistaId) : null;
    if (dentistaId && !dentista) return erro(res, 404, 'Dentista não encontrado');

    const m = MODELOS.find((x) => x.id === modelo) || MODELOS[0];
    const proc = procedimento || m.procedimentoPadrao;
    titulo = (titulo || m.titulo).trim();
    conteudo = (conteudo || preencher(m.corpo, { paciente, dentista, procedimento: proc, clinica: lerClinica() })).trim();
    if (!conteudo) return erro(res, 400, 'O texto do termo não pode ficar vazio');

    const quem = autor(req);
    const r = db.prepare(`INSERT INTO termos_consentimento
      (pacienteId, dentistaId, modelo, titulo, procedimento, conteudo, status, criadoPorId, criadoPorNome)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`)
      .run(paciente.id, dentista?.id || null, m.id, titulo, proc || null, conteudo, quem.id, quem.nome);

    const criado = buscar(r.lastInsertRowid);
    auditar(req, 'criou', criado);
    res.status(201).json(criado);
  } catch (e) {
    erro(res, e.status || 500, e.message);
  }
};

/** Edição do texto: só enquanto o termo não foi assinado. */
exports.atualizar = (req, res) => {
  try {
    const t = buscar(req.params.id);
    if (!t) return erro(res, 404, 'Termo não encontrado');
    if (t.status !== 'pendente') return erro(res, 400, 'Termo assinado ou revogado não pode ser alterado. Crie um novo termo.');

    const { titulo, conteudo, procedimento, dentistaId } = req.body;
    if (conteudo !== undefined && !String(conteudo).trim()) return erro(res, 400, 'O texto do termo não pode ficar vazio');
    if (dentistaId && !db.prepare('SELECT id FROM dentistas WHERE id = ?').get(dentistaId)) {
      return erro(res, 404, 'Dentista não encontrado');
    }

    const quem = autor(req);
    db.prepare(`UPDATE termos_consentimento SET titulo=?, conteudo=?, procedimento=?, dentistaId=?,
                atualizadoPorId=?, atualizadoPorNome=?, updatedAt=datetime('now') WHERE id=?`)
      .run(titulo?.trim() || t.titulo, conteudo !== undefined ? String(conteudo).trim() : t.conteudo,
        procedimento !== undefined ? (procedimento || null) : t.procedimento,
        dentistaId !== undefined ? (dentistaId || null) : t.dentistaId,
        quem.id, quem.nome, t.id);
    const atualizado = buscar(t.id);
    auditar(req, 'editou', atualizado);
    res.json(atualizado);
  } catch (e) {
    erro(res, e.status || 500, e.message);
  }
};

/**
 * Registra a assinatura.
 *  - formaAssinatura 'digital': exige a imagem da assinatura (desenhada na tela).
 *  - formaAssinatura 'papel'  : o termo foi impresso e assinado à mão; guarda-se só o registro.
 */
exports.assinar = (req, res) => {
  try {
    const t = buscar(req.params.id);
    if (!t) return erro(res, 404, 'Termo não encontrado');
    if (t.status !== 'pendente') return erro(res, 400, 'Este termo já foi assinado ou revogado');

    const { formaAssinatura = 'digital', assinanteNome, assinanteDocumento, assinanteRelacao = 'paciente', assinaturaImagem } = req.body || {};
    if (!['digital', 'papel'].includes(formaAssinatura)) return erro(res, 400, 'Forma de assinatura inválida');
    if (!assinanteNome?.trim()) return erro(res, 400, 'Informe o nome de quem está assinando');
    if (formaAssinatura === 'digital' && !assinaturaImagem) return erro(res, 400, 'Faça a assinatura no quadro antes de confirmar');

    const imagem = formaAssinatura === 'digital' ? salvarDataUrl(assinaturaImagem, 'assinaturas') : null;
    const quem = autor(req);
    db.prepare(`UPDATE termos_consentimento SET status='assinado', formaAssinatura=?, assinanteNome=?, assinanteDocumento=?,
                assinanteRelacao=?, assinaturaImagem=?, assinadoEm=datetime('now'),
                atualizadoPorId=?, atualizadoPorNome=?, updatedAt=datetime('now') WHERE id=?`)
      .run(formaAssinatura, assinanteNome.trim(), assinanteDocumento || null,
        assinanteRelacao === 'responsavel' ? 'responsavel' : 'paciente', imagem, quem.id, quem.nome, t.id);

    const assinado = buscar(t.id);
    auditar(req, 'registrou assinatura', assinado, formaAssinatura === 'digital' ? 'assinatura na tela' : 'assinado no papel');
    res.json(assinado);
  } catch (e) {
    erro(res, e.status || 500, e.message);
  }
};

/** Revogação: o paciente retira o consentimento. O termo continua no histórico. */
exports.revogar = (req, res) => {
  try {
    const t = buscar(req.params.id);
    if (!t) return erro(res, 404, 'Termo não encontrado');
    if (t.status !== 'assinado') return erro(res, 400, 'Só é possível revogar um termo assinado');
    const { motivo } = req.body || {};
    const quem = autor(req);
    db.prepare(`UPDATE termos_consentimento SET status='revogado', revogadoEm=datetime('now'), motivoRevogacao=?,
                atualizadoPorId=?, atualizadoPorNome=?, updatedAt=datetime('now') WHERE id=?`)
      .run(motivo || null, quem.id, quem.nome, t.id);
    const revogado = buscar(t.id);
    auditar(req, 'revogou', revogado, motivo || '');
    res.json(revogado);
  } catch (e) {
    erro(res, e.status || 500, e.message);
  }
};

/** Exclusão: termo pendente pode ser apagado; assinado, só pelo admin. */
exports.excluir = (req, res) => {
  const t = buscar(req.params.id);
  if (!t) return erro(res, 404, 'Termo não encontrado');
  if (t.status !== 'pendente' && req.usuario?.perfil !== 'admin') {
    return erro(res, 403, 'Termo assinado não pode ser excluído. Se o paciente retirou o consentimento, use "Revogar".');
  }
  db.prepare('DELETE FROM termos_consentimento WHERE id = ?').run(t.id);
  removerArquivo(t.assinaturaImagem);
  auditar(req, 'excluiu', t);
  res.json({ mensagem: 'Termo excluído' });
};

module.exports.MODELOS = MODELOS;
