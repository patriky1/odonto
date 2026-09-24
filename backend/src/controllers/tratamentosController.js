const db = require('../database/db');
const { salvarDataUrl, removerArquivo } = require('./uploadController');
const { autor, registrarAuditoria } = require('../utils/auditoria');

const ROTULO_STATUS = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };

const MAX_IMAGENS = 10;

/** Coluna `imagens` (JSON) → lista de caminhos. */
const lerImagens = (t) => {
  try {
    const lista = JSON.parse(t?.imagens || '[]');
    return Array.isArray(lista) ? lista.filter(Boolean) : [];
  } catch {
    return [];
  }
};

/** Devolve o tratamento com `imagens` já como lista. */
const comImagens = (t) => (t ? { ...t, imagens: lerImagens(t) } : t);

/**
 * Grava a galeria enviada pela tela. Cada item pode ser um caminho já salvo
 * (/uploads/...) ou uma imagem nova (data URL). Devolve a lista de caminhos.
 */
const salvarGaleria = (imagens) => {
  if (!Array.isArray(imagens)) return [];
  const lista = imagens.filter(Boolean);
  if (lista.length > MAX_IMAGENS) {
    throw Object.assign(new Error(`Cada tratamento aceita no máximo ${MAX_IMAGENS} imagens`), { status: 400 });
  }
  return lista.map((img) => salvarDataUrl(img, 'tratamentos'));
};

/** Nome curto do tratamento a partir da descrição (primeira linha). */
const nomeDaDescricao = (descricao) => {
  const linha = String(descricao || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  return linha.length > 80 ? `${linha.slice(0, 77)}...` : linha;
};

const nomePaciente = (id) => db.prepare('SELECT nome FROM pacientes WHERE id = ?').get(id)?.nome || `Paciente #${id}`;

const auditar = (req, acao, t, extra = '') => registrarAuditoria(req, {
  entidade: 'tratamento',
  entidadeId: t?.id,
  acao,
  descricao: `${t?.nome || 'Tratamento'} — ${nomePaciente(t?.pacienteId)}${extra ? ` (${extra})` : ''}`,
  pacienteId: t?.pacienteId,
  dentistaId: t?.dentistaId,
});

exports.listar = (req, res) => {
  const { pacienteId, status, comFotos, dentistaId } = req.query;
  let sql = `SELECT t.*, p.nome as pacienteNome, d.nome as dentistaNome
             FROM tratamentos t
             LEFT JOIN pacientes p ON t.pacienteId = p.id
             LEFT JOIN dentistas d ON t.dentistaId = d.id
             WHERE 1=1`;
  const params = [];
  if (pacienteId) { sql += ' AND t.pacienteId = ?'; params.push(pacienteId); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (dentistaId) { sql += ' AND t.dentistaId = ?'; params.push(dentistaId); }
  if (comFotos === 'true') { sql += " AND t.imagens IS NOT NULL AND t.imagens <> '[]'"; }
  sql += ' ORDER BY t.createdAt DESC';
  const rows = db.prepare(sql).all(...params).map(comImagens);
  rows.forEach(r => { r.paciente = { id: r.pacienteId, nome: r.pacienteNome }; delete r.pacienteNome; });
  res.json(rows);
};

exports.buscarPorId = (req, res) => {
  const t = db.prepare("SELECT t.*, p.nome as pacienteNome FROM tratamentos t LEFT JOIN pacientes p ON t.pacienteId = p.id WHERE t.id = ?").get(req.params.id);
  if (!t) return res.status(404).json({ erro: 'Tratamento não encontrado', error: 'Tratamento não encontrado' });
  t.paciente = { id: t.pacienteId, nome: t.pacienteNome }; delete t.pacienteNome;
  res.json(comImagens(t));
};

exports.criar = (req, res) => {
  try {
    const { pacienteId, descricao, valor = 0, sessoes = 1, sessoesRealizadas = 0, status = 'nao_iniciado', dentistaId, imagens } = req.body;
    // A tela pede só a descrição; o nome é tirado dela quando não vem preenchido
    const nome = String(req.body.nome || '').trim() || nomeDaDescricao(descricao);
    if (!pacienteId || !nome) return res.status(400).json({ erro: 'Paciente e descrição são obrigatórios', error: 'Paciente e descrição são obrigatórios' });

    // As imagens são opcionais — o tratamento salva normalmente sem elas
    const galeria = salvarGaleria(imagens);

    const quem = autor(req);
    const r = db.prepare(`INSERT INTO tratamentos
      (pacienteId, nome, descricao, valor, sessoes, sessoesRealizadas, status, dentistaId, imagens, criadoPorId, criadoPorNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pacienteId, nome, descricao||null, valor, sessoes, sessoesRealizadas, status, dentistaId||null,
        JSON.stringify(galeria), quem.id, quem.nome);
    const criado = comImagens(db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(r.lastInsertRowid));
    auditar(req, 'criou', criado, galeria.length ? `${galeria.length} imagem(ns)` : '');
    res.status(201).json(criado);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const t = db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(id);
    if (!t) return res.status(404).json({ erro: 'Tratamento não encontrado', error: 'Tratamento não encontrado' });
    const { descricao, valor, sessoes, sessoesRealizadas, status, dentistaId, imagens } = req.body;
    const nome = String(req.body.nome || '').trim() || (descricao !== undefined ? nomeDaDescricao(descricao) : '') || t.nome;

    // Galeria: undefined = não mexe | lista = nova galeria (o que saiu da lista é apagado do disco)
    const anteriores = lerImagens(t);
    let galeria = anteriores;
    if (imagens !== undefined) {
      galeria = salvarGaleria(imagens);
      anteriores.filter((c) => !galeria.includes(c)).forEach(removerArquivo);
    }

    const quem = autor(req);
    db.prepare(`UPDATE tratamentos SET nome=?, descricao=?, valor=?, sessoes=?, sessoesRealizadas=?, status=?, dentistaId=?,
                imagens=?, atualizadoPorId=?, atualizadoPorNome=?, updatedAt=datetime('now') WHERE id=?`)
      .run(nome, descricao ?? t.descricao, valor !== undefined ? valor : t.valor,
        sessoes||t.sessoes, sessoesRealizadas !== undefined ? sessoesRealizadas : t.sessoesRealizadas,
        status||t.status, dentistaId !== undefined ? (dentistaId||null) : t.dentistaId,
        JSON.stringify(galeria), quem.id, quem.nome, id);
    const atualizado = comImagens(db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(id));
    const mudancas = [];
    if (t.status !== atualizado.status) mudancas.push(`status: ${ROTULO_STATUS[t.status] || t.status} → ${ROTULO_STATUS[atualizado.status] || atualizado.status}`);
    if (t.descricao !== atualizado.descricao) mudancas.push('descrição alterada');
    if (anteriores.length !== galeria.length || anteriores.some((c, i) => c !== galeria[i])) mudancas.push(`galeria: ${galeria.length} imagem(ns)`);
    auditar(req, 'editou', atualizado, mudancas.join('; '));
    res.json(atualizado);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

exports.excluir = (req, res) => {
  const t = db.prepare('SELECT * FROM tratamentos WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ erro: 'Tratamento não encontrado', error: 'Tratamento não encontrado' });
  // Não deixa imagens órfãs no disco
  lerImagens(t).forEach(removerArquivo);
  removerArquivo(t.fotoAntes);
  removerArquivo(t.fotoDepois);
  db.prepare('DELETE FROM tratamentos WHERE id = ?').run(req.params.id);
  auditar(req, 'excluiu', t);
  res.json({ mensagem: 'Tratamento excluído' });
};

exports.comImagens = comImagens;
