const db = require('../database/db');
const { autor, registrarAuditoria } = require('../utils/auditoria');

/**
 * ORÇAMENTO CLÍNICO
 * Cada procedimento indicado no odontograma vira uma linha do orçamento
 * do paciente: dente (ou boca inteira), faces, procedimento, preço e se
 * já foi realizado. O total é calculado na tela.
 */

const FACES_VALIDAS = ['V', 'L', 'M', 'D', 'O'];

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });

/** ["o", "M", "x"] ou "M,O" → "M,O" (só faces válidas, sem repetir, na ordem V L M D O). */
const normalizarFaces = (faces) => {
  const lista = Array.isArray(faces) ? faces : String(faces || '').split(',');
  const validas = new Set(lista.map((f) => String(f).trim().toUpperCase()).filter((f) => FACES_VALIDAS.includes(f)));
  return FACES_VALIDAS.filter((f) => validas.has(f)).join(',') || null;
};

/** '' / null → null; 150.5, "150.50" e "1.150,50" são aceitos */
const normalizarValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const texto = String(valor).trim();
  const n = typeof valor === 'number' ? valor
    : Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
  if (!Number.isFinite(n) || n < 0) throw erro(400, 'Valor inválido');
  return Math.round(n * 100) / 100;
};

const normalizarDente = (numeroDente) => {
  if (numeroDente === null || numeroDente === undefined || numeroDente === '' || Number(numeroDente) === 0) return null;
  const n = parseInt(numeroDente, 10);
  const q = Math.floor(n / 10);
  const d = n % 10;
  const valido = (q >= 1 && q <= 4 && d >= 1 && d <= 8) || (q >= 5 && q <= 8 && d >= 1 && d <= 5);
  if (!valido) throw erro(400, `Dente ${numeroDente} inválido (use a numeração FDI)`);
  return n;
};

const formatar = (item) => item && { ...item, realizado: Boolean(item.realizado), faces: item.faces ? item.faces.split(',') : [] };

const buscar = (id) => formatar(db.prepare('SELECT * FROM orcamento_itens WHERE id = ?').get(id));

const descrever = (item) => `${item.procedimento} — ${item.numeroDente ? `dente ${item.numeroDente}` : 'boca inteira'}`;

const auditar = (req, acao, item, extra = '') => registrarAuditoria(req, {
  entidade: 'orcamento',
  entidadeId: item?.id,
  acao,
  descricao: `${descrever(item)}${extra ? ` (${extra})` : ''}`,
  pacienteId: item?.pacienteId,
});

/** Nome do procedimento: o texto enviado ou, na falta dele, o do cadastro. */
const resolverProcedimento = (procedimentoId, procedimento) => {
  const texto = String(procedimento || '').trim();
  if (!procedimentoId) return { procedimentoId: null, procedimento: texto };
  const cadastro = db.prepare('SELECT id, nome FROM procedimentos WHERE id = ?').get(procedimentoId);
  if (!cadastro) throw erro(400, 'Procedimento não encontrado no cadastro');
  return { procedimentoId: cadastro.id, procedimento: texto || cadastro.nome };
};

exports.listar = (req, res) => {
  try {
    const itens = db.prepare(`SELECT o.*, p.valor AS valorTabela
        FROM orcamento_itens o LEFT JOIN procedimentos p ON o.procedimentoId = p.id
        WHERE o.pacienteId = ? ORDER BY o.createdAt, o.id`).all(req.params.pacienteId);
    res.json(itens.map(formatar));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.criar = (req, res) => {
  try {
    const { pacienteId } = req.params;
    if (!db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId)) {
      return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });
    }

    const { numeroDente, faces, status, observacoes, valor } = req.body;
    const proc = resolverProcedimento(req.body.procedimentoId, req.body.procedimento);
    if (!proc.procedimento) return res.status(400).json({ erro: 'Informe o procedimento', error: 'Informe o procedimento' });

    const dente = normalizarDente(numeroDente);
    const quem = autor(req);
    const r = db.prepare(`INSERT INTO orcamento_itens
        (pacienteId, numeroDente, faces, status, procedimentoId, procedimento, valor, observacoes, criadoPorId, criadoPorNome)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pacienteId, dente, dente ? normalizarFaces(faces) : null, status || null,
        proc.procedimentoId, proc.procedimento, normalizarValor(valor), observacoes || null, quem.id, quem.nome);

    const item = buscar(r.lastInsertRowid);
    auditar(req, 'criou', item);
    res.status(201).json(item);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

/** Atualiza só os campos enviados (preço, procedimento, observações, realizado...). */
exports.atualizar = (req, res) => {
  try {
    const atual = db.prepare('SELECT * FROM orcamento_itens WHERE id = ?').get(req.params.id);
    if (!atual) return res.status(404).json({ erro: 'Item do orçamento não encontrado', error: 'Item do orçamento não encontrado' });

    const b = req.body;
    const campos = {};
    if (b.procedimentoId !== undefined || b.procedimento !== undefined) {
      const proc = resolverProcedimento(
        b.procedimentoId !== undefined ? b.procedimentoId : atual.procedimentoId,
        b.procedimento !== undefined ? b.procedimento : atual.procedimento,
      );
      if (!proc.procedimento) throw erro(400, 'Informe o procedimento');
      Object.assign(campos, proc);
    }
    if (b.valor !== undefined) campos.valor = normalizarValor(b.valor);
    if (b.observacoes !== undefined) campos.observacoes = b.observacoes || null;
    if (b.status !== undefined) campos.status = b.status || null;
    if (b.numeroDente !== undefined) campos.numeroDente = normalizarDente(b.numeroDente);
    const dente = campos.numeroDente !== undefined ? campos.numeroDente : atual.numeroDente;
    if (b.faces !== undefined || !dente) campos.faces = dente ? normalizarFaces(b.faces) : null;
    if (b.realizado !== undefined) {
      campos.realizado = b.realizado ? 1 : 0;
      campos.realizadoEm = b.realizado ? (atual.realizadoEm || new Date().toISOString()) : null;
    }

    const quem = autor(req);
    Object.assign(campos, { atualizadoPorId: quem.id, atualizadoPorNome: quem.nome });
    const colunas = Object.keys(campos);
    db.prepare(`UPDATE orcamento_itens SET ${colunas.map((c) => `${c} = ?`).join(', ')}, updatedAt = datetime('now') WHERE id = ?`)
      .run(...colunas.map((c) => campos[c]), atual.id);

    const item = buscar(atual.id);
    const mudancas = [];
    if (b.realizado !== undefined && Boolean(atual.realizado) !== item.realizado) mudancas.push(item.realizado ? 'marcado como realizado' : 'desmarcado como realizado');
    if (b.valor !== undefined && atual.valor !== item.valor) mudancas.push('preço alterado');
    auditar(req, 'editou', item, mudancas.join('; '));
    res.json(item);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

exports.excluir = (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM orcamento_itens WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ erro: 'Item do orçamento não encontrado', error: 'Item do orçamento não encontrado' });
    db.prepare('DELETE FROM orcamento_itens WHERE id = ?').run(item.id);
    auditar(req, 'excluiu', item);
    res.json({ mensagem: 'Item removido do orçamento' });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};
