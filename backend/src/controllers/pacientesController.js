const db = require('../database/db');
const { salvarDataUrl, removerArquivo } = require('./uploadController');
const { comImagens } = require('./tratamentosController');

exports.listar = (req, res) => {
  const { busca = '', pagina = 1, limite = 20, cidadeAtendimento } = req.query;
  const offset = (parseInt(pagina) - 1) * parseInt(limite);
  const like = `%${busca}%`;
  // IFNULL evita perder pacientes sem CPF ou telefone cadastrados
  const filtro = `ativo = 1 AND (nome LIKE ? OR IFNULL(cpf,'') LIKE ? OR IFNULL(telefone,'') LIKE ? OR IFNULL(email,'') LIKE ?)`
    + (cidadeAtendimento ? ' AND cidadeAtendimento = ?' : '');
  const args = cidadeAtendimento ? [like, like, like, like, cidadeAtendimento] : [like, like, like, like];
  const total = db.prepare(`SELECT COUNT(*) as c FROM pacientes WHERE ${filtro}`).get(...args).c;
  const pacientes = db.prepare(`SELECT * FROM pacientes WHERE ${filtro} ORDER BY nome LIMIT ? OFFSET ?`).all(...args, parseInt(limite), offset);
  pacientes.forEach(p => p.ativo = Boolean(p.ativo));
  res.json({ pacientes, total, pagina: parseInt(pagina), totalPaginas: Math.ceil(total / parseInt(limite)) });
};

exports.buscarPorId = (req, res) => {
  const p = db.prepare('SELECT * FROM pacientes WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Paciente não encontrado' });
  p.ativo = Boolean(p.ativo);
  p.agendamentos = db.prepare("SELECT a.*, d.nome as dentistaNome, pr.nome as procedimentoNome FROM agendamentos a LEFT JOIN dentistas d ON a.dentistaId = d.id LEFT JOIN procedimentos pr ON a.procedimentoId = pr.id WHERE a.pacienteId = ? ORDER BY a.data DESC, a.horaInicio DESC LIMIT 10").all(p.id);
  p.tratamentos = db.prepare('SELECT * FROM tratamentos WHERE pacienteId = ? ORDER BY createdAt DESC').all(p.id).map(comImagens);
  p.pagamentos = db.prepare('SELECT * FROM pagamentos WHERE pacienteId = ? ORDER BY createdAt DESC LIMIT 10').all(p.id);

  // Anamnese odontológica e procedimentos ortodônticos
  const anamnese = db.prepare('SELECT * FROM anamneses WHERE pacienteId = ?').get(p.id);
  if (anamnese) {
    try { anamnese.respostas = JSON.parse(anamnese.respostas || '{}'); } catch { anamnese.respostas = {}; }
  }
  p.anamnese = anamnese || null;
  p.ortodontia = db.prepare(`SELECT o.*, d.nome AS dentistaNome FROM ortodontia o
                             LEFT JOIN dentistas d ON o.dentistaId = d.id
                             WHERE o.pacienteId = ? ORDER BY date(o.data) DESC, o.id DESC`).all(p.id);
  res.json(p);
};

exports.criar = (req, res) => {
  try {
    const { nome, cpf, dataNascimento, sexo, telefone, whatsapp, email, endereco, cidade, estado, cep, responsavel, observacoes, linkIdoc, cidadeAtendimento } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório', error: 'Nome é obrigatório' });
    if (linkIdoc && !/^https?:\/\//i.test(linkIdoc)) {
      return res.status(400).json({ erro: 'O link do iDoc deve começar com http:// ou https://', error: 'O link do iDoc deve começar com http:// ou https://' });
    }
    if (cpf) {
      const existe = db.prepare('SELECT id FROM pacientes WHERE cpf = ? AND ativo = 1').get(cpf);
      if (existe) return res.status(400).json({ erro: 'CPF já cadastrado' });
    }
    const r = db.prepare("INSERT INTO pacientes (nome, cpf, dataNascimento, sexo, telefone, whatsapp, email, endereco, cidade, estado, cep, responsavel, observacoes, linkIdoc, cidadeAtendimento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(nome, cpf || null, dataNascimento || null, sexo || null, telefone || null, whatsapp || null, email || null, endereco || null, cidade || null, estado || null, cep || null, responsavel || null, observacoes || null, linkIdoc || null, cidadeAtendimento || null);
    const novo = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(r.lastInsertRowid);
    novo.ativo = Boolean(novo.ativo);
    res.status(201).json(novo);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const p = db.prepare('SELECT * FROM pacientes WHERE id = ? AND ativo = 1').get(id);
    if (!p) return res.status(404).json({ erro: 'Paciente não encontrado' });
    const { nome, cpf, dataNascimento, sexo, telefone, whatsapp, email, endereco, cidade, estado, cep, responsavel, observacoes, linkIdoc, cidadeAtendimento } = req.body;
    if (linkIdoc && !/^https?:\/\//i.test(linkIdoc)) {
      return res.status(400).json({ erro: 'O link do iDoc deve começar com http:// ou https://', error: 'O link do iDoc deve começar com http:// ou https://' });
    }
    if (cpf && cpf !== p.cpf) {
      const existe = db.prepare('SELECT id FROM pacientes WHERE cpf = ? AND id != ? AND ativo = 1').get(cpf, id);
      if (existe) return res.status(400).json({ erro: 'CPF já cadastrado' });
    }
    // ?? em vez de || para permitir limpar campos
    db.prepare("UPDATE pacientes SET nome=?, cpf=?, dataNascimento=?, sexo=?, telefone=?, whatsapp=?, email=?, endereco=?, cidade=?, estado=?, cep=?, responsavel=?, observacoes=?, linkIdoc=?, cidadeAtendimento=?, updatedAt=datetime('now') WHERE id=?")
      .run(nome || p.nome, cpf ?? p.cpf, dataNascimento ?? p.dataNascimento, sexo ?? p.sexo,
        telefone ?? p.telefone, whatsapp ?? p.whatsapp, email ?? p.email, endereco ?? p.endereco,
        cidade ?? p.cidade, estado ?? p.estado, cep ?? p.cep, responsavel ?? p.responsavel,
        observacoes ?? p.observacoes,
        linkIdoc !== undefined ? (linkIdoc || null) : p.linkIdoc,
        cidadeAtendimento !== undefined ? (cidadeAtendimento || null) : p.cidadeAtendimento, id);
    const atualizado = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(id);
    atualizado.ativo = Boolean(atualizado.ativo);
    res.json(atualizado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

/**
 * Foto de perfil do paciente.
 * Recebe { foto } como data URL (webcam ou arquivo); string vazia remove a foto.
 */
exports.atualizarFoto = (req, res) => {
  try {
    const p = db.prepare('SELECT id, foto FROM pacientes WHERE id = ? AND ativo = 1').get(req.params.id);
    if (!p) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const { foto } = req.body || {};
    let caminho = null;
    if (foto) {
      caminho = salvarDataUrl(foto, 'pacientes');
      if (caminho !== p.foto) removerArquivo(p.foto);
    } else {
      removerArquivo(p.foto);
    }

    db.prepare("UPDATE pacientes SET foto = ?, updatedAt = datetime('now') WHERE id = ?").run(caminho, p.id);
    res.json({ foto: caminho });
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

exports.excluir = (req, res) => {
  const p = db.prepare('SELECT id FROM pacientes WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Paciente não encontrado' });
  db.prepare("UPDATE pacientes SET ativo = 0, updatedAt = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ mensagem: 'Paciente removido' });
};

exports.historico = (req, res) => {
  const { id } = req.params;
  const agendamentos = db.prepare("SELECT a.*, d.nome as dentistaNome, pr.nome as procedimentoNome FROM agendamentos a LEFT JOIN dentistas d ON a.dentistaId = d.id LEFT JOIN procedimentos pr ON a.procedimentoId = pr.id WHERE a.pacienteId = ? ORDER BY a.data DESC").all(id);
  const prontuarios = db.prepare('SELECT * FROM prontuarios WHERE pacienteId = ? ORDER BY data DESC').all(id);
  res.json({ agendamentos, prontuarios });
};

exports.aniversariantes = (req, res) => {
  const mes = req.query.mes || new Date().getMonth() + 1;
  const pacientes = db.prepare("SELECT * FROM pacientes WHERE ativo = 1 AND strftime('%m', dataNascimento) = ? ORDER BY strftime('%d', dataNascimento)").all(String(mes).padStart(2, '0'));
  pacientes.forEach(p => p.ativo = Boolean(p.ativo));
  res.json(pacientes);
};
