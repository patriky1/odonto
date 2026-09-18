const db = require('../database/db');

/* ================================================================== *
 * HELPERS
 * ================================================================== */

// Datas no fuso da clínica (antes usava UTC e o "hoje" virava às 21h)
const { hojeISO, mesISO } = require('../utils/datas');

/** Primeiro e último dia do mês informado (YYYY-MM). */
const limitesDoMes = (ym) => {
  const [ano, mes] = ym.split('-').map(Number);
  const fim = new Date(ano, mes, 0).getDate();
  return { inicio: `${ym}-01`, fim: `${ym}-${String(fim).padStart(2, '0')}` };
};

/**
 * Normaliza o período recebido por query string.
 * Aceita ?inicio=&fim= ou ?mes=YYYY-MM. Sem nada, usa o mês corrente.
 */
const periodoDaQuery = (query = {}) => {
  if (query.inicio && query.fim) return { inicio: query.inicio, fim: query.fim };
  return limitesDoMes(query.mes || mesISO());
};

const num = (v, padrao = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : padrao;
};

/** Soma um mês a uma data YYYY-MM-DD respeitando o fim do mês. */
const somarPeriodo = (dataISO, frequencia) => {
  const meses = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }[frequencia] || 1;
  const d = new Date(`${dataISO}T12:00:00`);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + meses);
  if (d.getDate() < diaOriginal) d.setDate(0); // estourou o mês → último dia
  return d.toISOString().split('T')[0];
};

/** Marca como atrasado tudo que venceu e não foi pago. */
const atualizarVencidos = () => {
  const hoje = hojeISO();
  db.prepare(`UPDATE pagamentos SET status = 'atrasado', updatedAt = datetime('now')
              WHERE status = 'pendente' AND dataVencimento IS NOT NULL AND date(dataVencimento) < date(?)`).run(hoje);
  db.prepare(`UPDATE despesas SET status = 'atrasado', updatedAt = datetime('now')
              WHERE status = 'pendente' AND dataVencimento IS NOT NULL AND date(dataVencimento) < date(?)`).run(hoje);
};

/* ================================================================== *
 * CATEGORIAS PADRÃO (gastos da empresa)
 * ================================================================== */

const CATEGORIAS_DESPESA = [
  { value: 'aluguel', label: 'Aluguel', grupo: 'fixo' },
  { value: 'condominio', label: 'Condomínio', grupo: 'fixo' },
  { value: 'agua_luz', label: 'Água / Luz', grupo: 'fixo' },
  { value: 'internet_telefone', label: 'Internet / Telefone', grupo: 'fixo' },
  { value: 'pessoal', label: 'Salários e Encargos', grupo: 'pessoal' },
  { value: 'pro_labore', label: 'Pró-labore', grupo: 'pessoal' },
  { value: 'materiais', label: 'Materiais Odontológicos', grupo: 'variavel' },
  { value: 'medicamentos', label: 'Medicamentos', grupo: 'variavel' },
  { value: 'laboratorio', label: 'Laboratório / Protético', grupo: 'variavel' },
  { value: 'equipamentos', label: 'Equipamentos', grupo: 'investimento' },
  { value: 'manutencao', label: 'Manutenção e Reparos', grupo: 'variavel' },
  { value: 'limpeza', label: 'Limpeza e Higienização', grupo: 'variavel' },
  { value: 'marketing', label: 'Marketing e Publicidade', grupo: 'variavel' },
  { value: 'software', label: 'Softwares e Sistemas', grupo: 'fixo' },
  { value: 'impostos', label: 'Impostos e Taxas', grupo: 'tributario' },
  { value: 'contabilidade', label: 'Contabilidade', grupo: 'fixo' },
  { value: 'treinamento', label: 'Cursos e Treinamentos', grupo: 'investimento' },
  { value: 'transporte', label: 'Transporte / Combustível', grupo: 'variavel' },
  { value: 'taxas_bancarias', label: 'Taxas Bancárias / Maquininha', grupo: 'tributario' },
  { value: 'outros', label: 'Outros', grupo: 'variavel' },
];

const CATEGORIAS_RECEITA = [
  { value: 'consultas', label: 'Consultas' },
  { value: 'tratamentos', label: 'Tratamentos' },
  { value: 'convenios', label: 'Convênios' },
  { value: 'produtos', label: 'Venda de Produtos' },
  { value: 'outros', label: 'Outras Receitas' },
];

exports.categorias = (req, res) => {
  res.json({ despesas: CATEGORIAS_DESPESA, receitas: CATEGORIAS_RECEITA });
};

/* ================================================================== *
 * PAGAMENTOS (recebimentos de pacientes)
 * ================================================================== */

exports.listarPagamentos = (req, res) => {
  try {
    atualizarVencidos();
    const { status, busca, inicio, fim, pacienteId } = req.query;
    let sql = `SELECT pg.*, p.nome AS pacienteNome, d.nome AS dentistaNome
               FROM pagamentos pg
               LEFT JOIN pacientes p ON pg.pacienteId = p.id
               LEFT JOIN dentistas d ON pg.dentistaId = d.id
               WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND pg.status = ?'; params.push(status); }
    if (pacienteId) { sql += ' AND pg.pacienteId = ?'; params.push(pacienteId); }
    if (req.query.dentistaId) { sql += ' AND pg.dentistaId = ?'; params.push(req.query.dentistaId); }
    if (busca) {
      sql += ' AND (pg.descricao LIKE ? OR p.nome LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`);
    }
    if (inicio && fim) {
      sql += " AND date(COALESCE(pg.dataVencimento, pg.dataPagamento, pg.createdAt)) BETWEEN date(?) AND date(?)";
      params.push(inicio, fim);
    }
    sql += ' ORDER BY COALESCE(pg.dataVencimento, pg.createdAt) DESC, pg.id DESC';

    const rows = db.prepare(sql).all(...params);
    rows.forEach((r) => {
      r.paciente = { id: r.pacienteId, nome: r.pacienteNome };
      r.saldo = num(r.valor) - num(r.valorPago);
      delete r.pacienteNome;
    });

    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.buscarPagamento = (req, res) => {
  const pg = db.prepare(`SELECT pg.*, p.nome AS pacienteNome, d.nome AS dentistaNome
                         FROM pagamentos pg
                         LEFT JOIN pacientes p ON pg.pacienteId = p.id
                         LEFT JOIN dentistas d ON pg.dentistaId = d.id
                         WHERE pg.id = ?`).get(req.params.id);
  if (!pg) return res.status(404).json({ erro: 'Pagamento não encontrado', error: 'Pagamento não encontrado' });
  pg.paciente = { id: pg.pacienteId, nome: pg.pacienteNome };
  pg.saldo = num(pg.valor) - num(pg.valorPago);
  delete pg.pacienteNome;
  res.json(pg);
};

exports.criarPagamento = (req, res) => {
  try {
    const {
      pacienteId, descricao, valor, valorPago = 0, dataVencimento, dataPagamento,
      formaPagamento, parcelas = 1, status, observacoes, dentistaId,
    } = req.body;

    if (!pacienteId) return res.status(400).json({ erro: 'Selecione o paciente', error: 'Selecione o paciente' });
    if (!descricao?.trim()) return res.status(400).json({ erro: 'Descrição é obrigatória', error: 'Descrição é obrigatória' });
    if (valor === undefined || num(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor maior que zero', error: 'Informe um valor maior que zero' });

    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    // Status calculado automaticamente quando não informado
    let st = status;
    if (!st) {
      if (num(valorPago) >= num(valor)) st = 'pago';
      else if (dataVencimento && dataVencimento < hojeISO()) st = 'atrasado';
      else st = 'pendente';
    }

    if (dentistaId && !db.prepare('SELECT id FROM dentistas WHERE id = ?').get(dentistaId)) {
      return res.status(404).json({ erro: 'Dentista não encontrado', error: 'Dentista não encontrado' });
    }

    const r = db.prepare(`INSERT INTO pagamentos
        (pacienteId, descricao, valor, valorPago, dataVencimento, dataPagamento, formaPagamento, parcelas, status, observacoes, dentistaId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pacienteId, descricao.trim(), num(valor), num(valorPago), dataVencimento || null,
        dataPagamento || (st === 'pago' ? hojeISO() : null), formaPagamento || null,
        parseInt(parcelas) || 1, st, observacoes || null, dentistaId || null);

    res.status(201).json(db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.atualizarPagamento = (req, res) => {
  try {
    const { id } = req.params;
    const pg = db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(id);
    if (!pg) return res.status(404).json({ erro: 'Pagamento não encontrado', error: 'Pagamento não encontrado' });

    const b = req.body;
    // ?? em vez de || — permite limpar campos e gravar valor 0
    const novo = {
      pacienteId: b.pacienteId ?? pg.pacienteId,
      descricao: b.descricao ?? pg.descricao,
      valor: b.valor !== undefined ? num(b.valor) : pg.valor,
      valorPago: b.valorPago !== undefined ? num(b.valorPago) : pg.valorPago,
      dataVencimento: b.dataVencimento !== undefined ? (b.dataVencimento || null) : pg.dataVencimento,
      dataPagamento: b.dataPagamento !== undefined ? (b.dataPagamento || null) : pg.dataPagamento,
      formaPagamento: b.formaPagamento !== undefined ? (b.formaPagamento || null) : pg.formaPagamento,
      parcelas: b.parcelas !== undefined ? parseInt(b.parcelas) || 1 : pg.parcelas,
      status: b.status ?? pg.status,
      observacoes: b.observacoes !== undefined ? (b.observacoes || null) : pg.observacoes,
      dentistaId: b.dentistaId !== undefined ? (b.dentistaId || null) : pg.dentistaId,
    };

    if (novo.status === 'pago' && !novo.dataPagamento) novo.dataPagamento = hojeISO();
    if (novo.status === 'pago' && num(novo.valorPago) === 0) novo.valorPago = novo.valor;

    db.prepare(`UPDATE pagamentos SET pacienteId=?, descricao=?, valor=?, valorPago=?, dataVencimento=?,
                dataPagamento=?, formaPagamento=?, parcelas=?, status=?, observacoes=?, dentistaId=?,
                updatedAt=datetime('now') WHERE id=?`)
      .run(novo.pacienteId, novo.descricao, novo.valor, novo.valorPago, novo.dataVencimento,
        novo.dataPagamento, novo.formaPagamento, novo.parcelas, novo.status, novo.observacoes,
        novo.dentistaId, id);

    res.json(db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(id));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Baixa rápida: marca o pagamento como recebido hoje. */
exports.receberPagamento = (req, res) => {
  try {
    const pg = db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(req.params.id);
    if (!pg) return res.status(404).json({ erro: 'Pagamento não encontrado', error: 'Pagamento não encontrado' });
    const { formaPagamento, dataPagamento, valorPago } = req.body || {};
    db.prepare(`UPDATE pagamentos SET status='pago', valorPago=?, dataPagamento=?, formaPagamento=COALESCE(?, formaPagamento),
                updatedAt=datetime('now') WHERE id=?`)
      .run(valorPago !== undefined ? num(valorPago) : num(pg.valor), dataPagamento || hojeISO(), formaPagamento || null, req.params.id);
    res.json(db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.excluirPagamento = (req, res) => {
  const pg = db.prepare('SELECT id FROM pagamentos WHERE id = ?').get(req.params.id);
  if (!pg) return res.status(404).json({ erro: 'Pagamento não encontrado', error: 'Pagamento não encontrado' });
  db.prepare('DELETE FROM pagamentos WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Pagamento excluído' });
};

/* ================================================================== *
 * RECEITAS AVULSAS
 * ================================================================== */

exports.listarReceitas = (req, res) => {
  try {
    const { inicio, fim, categoria, busca } = req.query;
    let sql = 'SELECT * FROM receitas WHERE 1=1';
    const params = [];
    if (inicio && fim) { sql += ' AND date(data) BETWEEN date(?) AND date(?)'; params.push(inicio, fim); }
    if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
    if (busca) { sql += ' AND (descricao LIKE ? OR origem LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
    sql += ' ORDER BY date(data) DESC, id DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.criarReceita = (req, res) => {
  try {
    const { descricao, valor, data, categoria, formaPagamento, origem, observacoes } = req.body;
    if (!descricao?.trim()) return res.status(400).json({ erro: 'Descrição é obrigatória', error: 'Descrição é obrigatória' });
    if (valor === undefined || num(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor maior que zero', error: 'Informe um valor maior que zero' });

    const r = db.prepare(`INSERT INTO receitas (descricao, valor, data, categoria, formaPagamento, origem, observacoes, usuarioId)
                          VALUES (?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, ?)`)
      .run(descricao.trim(), num(valor), data || null, categoria || null, formaPagamento || null,
        origem || null, observacoes || null, req.usuario?.id || null);
    res.status(201).json(db.prepare('SELECT * FROM receitas WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.atualizarReceita = (req, res) => {
  try {
    const rec = db.prepare('SELECT * FROM receitas WHERE id = ?').get(req.params.id);
    if (!rec) return res.status(404).json({ erro: 'Receita não encontrada', error: 'Receita não encontrada' });
    const b = req.body;
    db.prepare(`UPDATE receitas SET descricao=?, valor=?, data=?, categoria=?, formaPagamento=?, origem=?,
                observacoes=?, updatedAt=datetime('now') WHERE id=?`)
      .run(b.descricao ?? rec.descricao, b.valor !== undefined ? num(b.valor) : rec.valor,
        b.data ?? rec.data, b.categoria !== undefined ? (b.categoria || null) : rec.categoria,
        b.formaPagamento !== undefined ? (b.formaPagamento || null) : rec.formaPagamento,
        b.origem !== undefined ? (b.origem || null) : rec.origem,
        b.observacoes !== undefined ? (b.observacoes || null) : rec.observacoes, req.params.id);
    res.json(db.prepare('SELECT * FROM receitas WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.excluirReceita = (req, res) => {
  const rec = db.prepare('SELECT id FROM receitas WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ erro: 'Receita não encontrada', error: 'Receita não encontrada' });
  db.prepare('DELETE FROM receitas WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Receita excluída' });
};

/* ================================================================== *
 * DESPESAS — CONTROLE DE GASTOS DA EMPRESA
 * ================================================================== */

exports.listarDespesas = (req, res) => {
  try {
    atualizarVencidos();
    const { inicio, fim, categoria, status, centroCusto, fornecedor, busca, recorrente } = req.query;

    let sql = 'SELECT * FROM despesas WHERE 1=1';
    const params = [];
    if (inicio && fim) { sql += ' AND date(data) BETWEEN date(?) AND date(?)'; params.push(inicio, fim); }
    if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (centroCusto) { sql += ' AND centroCusto = ?'; params.push(centroCusto); }
    if (fornecedor) { sql += ' AND fornecedor LIKE ?'; params.push(`%${fornecedor}%`); }
    if (recorrente === 'true') { sql += ' AND recorrente = 1'; }
    if (busca) {
      sql += " AND (descricao LIKE ? OR IFNULL(fornecedor, '') LIKE ? OR IFNULL(documento, '') LIKE ?)";
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }
    sql += ' ORDER BY date(data) DESC, id DESC';

    const despesas = db.prepare(sql).all(...params);
    despesas.forEach((d) => { d.recorrente = Boolean(d.recorrente); });
    res.json(despesas);
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.buscarDespesa = (req, res) => {
  const d = db.prepare('SELECT * FROM despesas WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ erro: 'Despesa não encontrada', error: 'Despesa não encontrada' });
  d.recorrente = Boolean(d.recorrente);
  res.json(d);
};

exports.criarDespesa = (req, res) => {
  try {
    const {
      descricao, valor, data, categoria, fornecedor, formaPagamento, dataVencimento,
      status, recorrente, frequencia, centroCusto, documento, observacoes,
      parcelas, gerarParcelas,
    } = req.body;

    if (!descricao?.trim()) return res.status(400).json({ erro: 'Descrição é obrigatória', error: 'Descrição é obrigatória' });
    if (valor === undefined || num(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor maior que zero', error: 'Informe um valor maior que zero' });

    const dataBase = data || hojeISO();
    let st = status;
    if (!st) st = dataVencimento && dataVencimento < hojeISO() ? 'atrasado' : 'pago';

    const inserir = db.prepare(`INSERT INTO despesas
      (descricao, valor, data, categoria, fornecedor, formaPagamento, dataVencimento, status,
       recorrente, frequencia, centroCusto, documento, observacoes, parcelaAtual, totalParcelas, usuarioId, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`);

    const totalParcelas = Math.max(1, parseInt(parcelas) || 1);
    const criadas = [];

    if (gerarParcelas && totalParcelas > 1) {
      // Divide o valor total entre as parcelas, ajustando centavos na última
      const valorTotal = Math.round(num(valor) * 100);
      const base = Math.floor(valorTotal / totalParcelas);
      const avancarMeses = (dataISO, meses) => {
        let d = dataISO;
        for (let k = 0; k < meses; k++) d = somarPeriodo(d, 'mensal');
        return d;
      };
      for (let i = 0; i < totalParcelas; i++) {
        const centavos = i === totalParcelas - 1 ? valorTotal - base * (totalParcelas - 1) : base;
        const dataParcela = avancarMeses(dataBase, i);
        const vencParcela = dataVencimento ? avancarMeses(dataVencimento, i) : null;
        const r = inserir.run(
          `${descricao.trim()} (${i + 1}/${totalParcelas})`, centavos / 100, dataParcela,
          categoria || null, fornecedor || null, formaPagamento || null, vencParcela,
          i === 0 ? st : 'pendente', 0, null, centroCusto || null, documento || null,
          observacoes || null, i + 1, totalParcelas, req.usuario?.id || null
        );
        criadas.push(db.prepare('SELECT * FROM despesas WHERE id = ?').get(r.lastInsertRowid));
      }
      return res.status(201).json({ mensagem: `${totalParcelas} parcelas criadas`, despesas: criadas });
    }

    const r = inserir.run(
      descricao.trim(), num(valor), dataBase, categoria || null, fornecedor || null,
      formaPagamento || null, dataVencimento || null, st,
      recorrente ? 1 : 0, recorrente ? (frequencia || 'mensal') : null,
      centroCusto || null, documento || null, observacoes || null, null, null, req.usuario?.id || null
    );
    const nova = db.prepare('SELECT * FROM despesas WHERE id = ?').get(r.lastInsertRowid);
    nova.recorrente = Boolean(nova.recorrente);
    res.status(201).json(nova);
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.atualizarDespesa = (req, res) => {
  try {
    const d = db.prepare('SELECT * FROM despesas WHERE id = ?').get(req.params.id);
    if (!d) return res.status(404).json({ erro: 'Despesa não encontrada', error: 'Despesa não encontrada' });
    const b = req.body;

    db.prepare(`UPDATE despesas SET descricao=?, valor=?, data=?, categoria=?, fornecedor=?, formaPagamento=?,
                dataVencimento=?, status=?, recorrente=?, frequencia=?, centroCusto=?, documento=?, observacoes=?,
                updatedAt=datetime('now') WHERE id=?`)
      .run(
        b.descricao ?? d.descricao,
        b.valor !== undefined ? num(b.valor) : d.valor,
        b.data ?? d.data,
        b.categoria !== undefined ? (b.categoria || null) : d.categoria,
        b.fornecedor !== undefined ? (b.fornecedor || null) : d.fornecedor,
        b.formaPagamento !== undefined ? (b.formaPagamento || null) : d.formaPagamento,
        b.dataVencimento !== undefined ? (b.dataVencimento || null) : d.dataVencimento,
        b.status ?? d.status,
        b.recorrente !== undefined ? (b.recorrente ? 1 : 0) : d.recorrente,
        b.frequencia !== undefined ? (b.frequencia || null) : d.frequencia,
        b.centroCusto !== undefined ? (b.centroCusto || null) : d.centroCusto,
        b.documento !== undefined ? (b.documento || null) : d.documento,
        b.observacoes !== undefined ? (b.observacoes || null) : d.observacoes,
        req.params.id
      );
    const atualizada = db.prepare('SELECT * FROM despesas WHERE id = ?').get(req.params.id);
    atualizada.recorrente = Boolean(atualizada.recorrente);
    res.json(atualizada);
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Baixa rápida: marca a despesa como paga. */
exports.pagarDespesa = (req, res) => {
  try {
    const d = db.prepare('SELECT * FROM despesas WHERE id = ?').get(req.params.id);
    if (!d) return res.status(404).json({ erro: 'Despesa não encontrada', error: 'Despesa não encontrada' });
    const { data, formaPagamento } = req.body || {};
    db.prepare(`UPDATE despesas SET status='pago', data=COALESCE(?, data),
                formaPagamento=COALESCE(?, formaPagamento), updatedAt=datetime('now') WHERE id=?`)
      .run(data || hojeISO(), formaPagamento || null, req.params.id);
    res.json(db.prepare('SELECT * FROM despesas WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.excluirDespesa = (req, res) => {
  const d = db.prepare('SELECT id FROM despesas WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ erro: 'Despesa não encontrada', error: 'Despesa não encontrada' });
  db.prepare('DELETE FROM despesas WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Despesa excluída' });
};

/**
 * Gera as próximas ocorrências das despesas fixas/recorrentes.
 * Idempotente: não duplica lançamentos já gerados para a mesma competência.
 */
exports.gerarRecorrentes = (req, res) => {
  try {
    const alvo = req.body?.mes || mesISO();
    const { inicio, fim } = limitesDoMes(alvo);
    const modelos = db.prepare('SELECT * FROM despesas WHERE recorrente = 1').all();
    const geradas = [];

    for (const m of modelos) {
      const jaExiste = db.prepare(`SELECT id FROM despesas
        WHERE origemId = ? AND date(data) BETWEEN date(?) AND date(?)`).get(m.id, inicio, fim);
      if (jaExiste) continue;
      if (m.data >= inicio && m.data <= fim) continue; // o próprio modelo é deste mês

      const dia = String(m.data).split('-')[2] || '01';
      const ultimoDia = limitesDoMes(alvo).fim.split('-')[2];
      const diaFinal = String(Math.min(parseInt(dia), parseInt(ultimoDia))).padStart(2, '0');
      const novaData = `${alvo}-${diaFinal}`;

      const r = db.prepare(`INSERT INTO despesas
        (descricao, valor, data, categoria, fornecedor, formaPagamento, dataVencimento, status,
         recorrente, frequencia, centroCusto, documento, observacoes, origemId, usuarioId, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', 0, ?, ?, ?, ?, ?, ?, datetime('now'))`)
        .run(m.descricao, m.valor, novaData, m.categoria, m.fornecedor, m.formaPagamento,
          novaData, m.frequencia, m.centroCusto, m.documento, m.observacoes, m.id, req.usuario?.id || null);
      geradas.push(db.prepare('SELECT * FROM despesas WHERE id = ?').get(r.lastInsertRowid));
    }

    res.json({ mensagem: `${geradas.length} despesa(s) recorrente(s) gerada(s) para ${alvo}`, geradas });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/* ================================================================== *
 * RELATÓRIO / DRE
 * ================================================================== */

exports.relatorio = (req, res) => {
  try {
    atualizarVencidos();
    const { inicio, fim } = periodoDaQuery(req.query);

    const escalar = (sql, ...params) => db.prepare(sql).get(...params).t || 0;

    const totalRecebido = escalar(
      `SELECT COALESCE(SUM(valorPago), 0) AS t FROM pagamentos
       WHERE status = 'pago' AND date(COALESCE(dataPagamento, createdAt)) BETWEEN date(?) AND date(?)`,
      inicio, fim
    );
    const totalReceitas = escalar(
      `SELECT COALESCE(SUM(valor), 0) AS t FROM receitas WHERE date(data) BETWEEN date(?) AND date(?)`,
      inicio, fim
    );
    const totalDespesas = escalar(
      `SELECT COALESCE(SUM(valor), 0) AS t FROM despesas WHERE date(data) BETWEEN date(?) AND date(?)`,
      inicio, fim
    );
    const despesasPagas = escalar(
      `SELECT COALESCE(SUM(valor), 0) AS t FROM despesas
       WHERE status = 'pago' AND date(data) BETWEEN date(?) AND date(?)`,
      inicio, fim
    );
    const despesasAPagar = escalar(
      `SELECT COALESCE(SUM(valor), 0) AS t FROM despesas WHERE status IN ('pendente', 'atrasado')`
    );
    const aReceber = escalar(
      `SELECT COALESCE(SUM(valor - valorPago), 0) AS t FROM pagamentos WHERE status IN ('pendente', 'atrasado')`
    );

    const entradas = totalRecebido + totalReceitas;
    const lucro = entradas - totalDespesas;
    const margem = entradas > 0 ? (lucro / entradas) * 100 : 0;

    const pagamentosPendentes = db.prepare("SELECT COUNT(*) AS c FROM pagamentos WHERE status = 'pendente'").get().c;
    const pagamentosAtrasados = db.prepare("SELECT COUNT(*) AS c FROM pagamentos WHERE status = 'atrasado'").get().c;
    const despesasAtrasadas = db.prepare("SELECT COUNT(*) AS c FROM despesas WHERE status = 'atrasado'").get().c;

    // Despesas agrupadas por categoria
    const rotulo = (v) => CATEGORIAS_DESPESA.find((c) => c.value === v)?.label || v || 'Sem categoria';
    const grupoDe = (v) => CATEGORIAS_DESPESA.find((c) => c.value === v)?.grupo || 'variavel';

    const porCategoria = db.prepare(
      `SELECT COALESCE(categoria, 'outros') AS categoria, SUM(valor) AS total, COUNT(*) AS qtd
       FROM despesas WHERE date(data) BETWEEN date(?) AND date(?)
       GROUP BY COALESCE(categoria, 'outros') ORDER BY total DESC`
    ).all(inicio, fim).map((r) => ({
      ...r,
      label: rotulo(r.categoria),
      grupo: grupoDe(r.categoria),
      percentual: totalDespesas > 0 ? (r.total / totalDespesas) * 100 : 0,
    }));

    // Agrupamento por natureza do gasto (fixo, variável, pessoal...)
    const porGrupo = Object.values(
      porCategoria.reduce((acc, c) => {
        acc[c.grupo] = acc[c.grupo] || { grupo: c.grupo, total: 0 };
        acc[c.grupo].total += c.total;
        return acc;
      }, {})
    ).sort((a, b) => b.total - a.total);

    const receitasPorCategoria = db.prepare(
      `SELECT COALESCE(categoria, 'outros') AS categoria, SUM(valor) AS total, COUNT(*) AS qtd
       FROM receitas WHERE date(data) BETWEEN date(?) AND date(?)
       GROUP BY COALESCE(categoria, 'outros') ORDER BY total DESC`
    ).all(inicio, fim).map((r) => ({
      ...r,
      label: CATEGORIAS_RECEITA.find((c) => c.value === r.categoria)?.label || r.categoria,
    }));

    const porFormaPagamento = db.prepare(
      `SELECT COALESCE(formaPagamento, 'nao_informado') AS forma, SUM(valorPago) AS total, COUNT(*) AS qtd
       FROM pagamentos WHERE status = 'pago' AND date(COALESCE(dataPagamento, createdAt)) BETWEEN date(?) AND date(?)
       GROUP BY COALESCE(formaPagamento, 'nao_informado') ORDER BY total DESC`
    ).all(inicio, fim);

    // Produção por dentista responsável
    const porDentista = db.prepare(
      `SELECT COALESCE(d.nome, 'Não informado') AS dentista, SUM(pg.valorPago) AS total, COUNT(*) AS qtd
       FROM pagamentos pg LEFT JOIN dentistas d ON pg.dentistaId = d.id
       WHERE pg.status = 'pago' AND date(COALESCE(pg.dataPagamento, pg.createdAt)) BETWEEN date(?) AND date(?)
       GROUP BY COALESCE(d.nome, 'Não informado') ORDER BY total DESC`
    ).all(inicio, fim);

    const maioresFornecedores = db.prepare(
      `SELECT fornecedor, SUM(valor) AS total, COUNT(*) AS qtd FROM despesas
       WHERE fornecedor IS NOT NULL AND fornecedor <> '' AND date(data) BETWEEN date(?) AND date(?)
       GROUP BY fornecedor ORDER BY total DESC LIMIT 5`
    ).all(inicio, fim);

    // Evolução dos últimos 6 meses (comparativo entradas x saídas)
    const evolucao = [];
    const ref = new Date(`${fim}T12:00:00`);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lim = limitesDoMes(ym);
      const rec = escalar(
        `SELECT COALESCE(SUM(valorPago), 0) AS t FROM pagamentos WHERE status='pago'
         AND date(COALESCE(dataPagamento, createdAt)) BETWEEN date(?) AND date(?)`, lim.inicio, lim.fim
      ) + escalar(
        `SELECT COALESCE(SUM(valor), 0) AS t FROM receitas WHERE date(data) BETWEEN date(?) AND date(?)`, lim.inicio, lim.fim
      );
      const des = escalar(
        `SELECT COALESCE(SUM(valor), 0) AS t FROM despesas WHERE date(data) BETWEEN date(?) AND date(?)`, lim.inicio, lim.fim
      );
      const [ano, mesN] = ym.split('-');
      const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      evolucao.push({ mes: ym, label: `${nomes[parseInt(mesN) - 1]}/${ano.slice(2)}`, receitas: rec, despesas: des, lucro: rec - des });
    }

    res.json({
      periodo: { inicio, fim },
      totalRecebido, totalReceitas, entradas,
      totalDespesas, despesasPagas, despesasAPagar, despesasAtrasadas,
      aReceber, lucro, margem,
      pagamentosPendentes, pagamentosAtrasados,
      porCategoria, porGrupo, receitasPorCategoria, porFormaPagamento, maioresFornecedores,
      porDentista, evolucao,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Exportação em CSV do fluxo de caixa do período. */
exports.exportarCSV = (req, res) => {
  try {
    const { inicio, fim } = periodoDaQuery(req.query);
    const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Fornecedor/Paciente', 'Dentista', 'Forma', 'Status', 'Valor']];

    db.prepare(`SELECT pg.*, p.nome AS pacienteNome, d.nome AS dentistaNome FROM pagamentos pg
                LEFT JOIN pacientes p ON pg.pacienteId = p.id
                LEFT JOIN dentistas d ON pg.dentistaId = d.id
                WHERE pg.status='pago' AND date(COALESCE(pg.dataPagamento, pg.createdAt)) BETWEEN date(?) AND date(?)`)
      .all(inicio, fim)
      .forEach((p) => linhas.push([p.dataPagamento || '', 'Recebimento', p.descricao, 'pacientes', p.pacienteNome || '', p.dentistaNome || '', p.formaPagamento || '', p.status, num(p.valorPago).toFixed(2)]));

    db.prepare('SELECT * FROM receitas WHERE date(data) BETWEEN date(?) AND date(?)').all(inicio, fim)
      .forEach((r) => linhas.push([r.data, 'Receita', r.descricao, r.categoria || '', r.origem || '', '', r.formaPagamento || '', 'recebido', num(r.valor).toFixed(2)]));

    db.prepare('SELECT * FROM despesas WHERE date(data) BETWEEN date(?) AND date(?)').all(inicio, fim)
      .forEach((d) => linhas.push([d.data, 'Despesa', d.descricao, d.categoria || '', d.fornecedor || '', '', d.formaPagamento || '', d.status, `-${num(d.valor).toFixed(2)}`]));

    const csv = linhas
      .map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="financeiro_${inicio}_a_${fim}.csv"`);
    res.send('﻿' + csv); // BOM para o Excel reconhecer os acentos
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};
