const db = require('../database/db');
const { registrarAuditoria } = require('../utils/auditoria');
const { lerClinica } = require('./configuracoesController');
const { hojeISO } = require('../utils/datas');

/* ================================================================== *
 * HELPERS
 * ================================================================== */

const num = (v, padrao = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : padrao;
};

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

const anoDe = (dataISO) => {
  const a = parseInt(String(dataISO || '').slice(0, 4), 10);
  return Number.isFinite(a) ? a : new Date().getFullYear();
};

/** Próximo número sequencial do ano (0001, 0002, ...). */
const proximoNumero = (ano) => {
  const r = db.prepare('SELECT MAX(numero) AS ultimo FROM recibos WHERE ano = ?').get(ano);
  return (r?.ultimo || 0) + 1;
};

/** Número exibido no documento: 0007/2026 */
const numeroFormatado = (numero, ano) => `${String(numero).padStart(4, '0')}/${ano}`;

/** Converte as colunas JSON em objeto e acrescenta o número formatado. */
const hidratar = (r) => {
  if (!r) return r;
  for (const campo of ['empresa', 'paciente', 'profissional']) {
    try { r[campo] = r[campo] ? JSON.parse(r[campo]) : null; } catch { r[campo] = null; }
  }
  r.cancelado = Boolean(r.cancelado);
  r.numeroFormatado = numeroFormatado(r.numero, r.ano);
  return r;
};

/* ================================================================== *
 * LISTAGEM / CONSULTA
 * ================================================================== */

exports.listar = (req, res) => {
  try {
    const { inicio, fim, pacienteId, busca, incluirCancelados } = req.query;
    let sql = `SELECT r.*, p.nome AS pacienteNomeAtual
               FROM recibos r
               LEFT JOIN pacientes p ON r.pacienteId = p.id
               WHERE 1=1`;
    const params = [];
    if (inicio && fim) { sql += ' AND date(r.dataEmissao) BETWEEN date(?) AND date(?)'; params.push(inicio, fim); }
    if (pacienteId) { sql += ' AND r.pacienteId = ?'; params.push(pacienteId); }
    if (req.query.dentistaId) { sql += ' AND r.dentistaId = ?'; params.push(req.query.dentistaId); }
    if (incluirCancelados !== 'true') sql += ' AND r.cancelado = 0';
    if (busca) {
      sql += " AND (r.pagadorNome LIKE ? OR r.descricao LIKE ? OR IFNULL(p.nome, '') LIKE ?)";
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }
    sql += ' ORDER BY r.ano DESC, r.numero DESC';

    res.json(db.prepare(sql).all(...params).map(hidratar));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.buscarPorId = (req, res) => {
  const r = db.prepare('SELECT * FROM recibos WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ erro: 'Recibo não encontrado', error: 'Recibo não encontrado' });
  res.json(hidratar(r));
};

/** Recibos já emitidos para um pagamento (evita segunda via indevida sem querer). */
exports.porPagamento = (req, res) => {
  const rows = db.prepare('SELECT * FROM recibos WHERE pagamentoId = ? ORDER BY id DESC')
    .all(req.params.pagamentoId);
  res.json(rows.map(hidratar));
};

/**
 * Dados sugeridos para um novo recibo a partir de um pagamento já lançado.
 * Evita redigitação: já vem com paciente, valor, descrição e forma de pagamento.
 */
exports.rascunhoDoPagamento = (req, res) => {
  const pg = db.prepare(`SELECT pg.*, p.nome AS pacienteNome, p.cpf AS pacienteCpf,
                                p.endereco, p.cidade, p.estado, p.cep, p.telefone,
                                d.nome AS dentistaNome, d.cro AS dentistaCro, d.especialidade
                         FROM pagamentos pg
                         LEFT JOIN pacientes p ON pg.pacienteId = p.id
                         LEFT JOIN dentistas d ON pg.dentistaId = d.id
                         WHERE pg.id = ?`).get(req.params.pagamentoId);
  if (!pg) return res.status(404).json({ erro: 'Pagamento não encontrado', error: 'Pagamento não encontrado' });

  const valorPago = num(pg.valorPago);
  res.json({
    pagamentoId: pg.id,
    pacienteId: pg.pacienteId,
    dentistaId: pg.dentistaId,
    valor: valorPago > 0 ? valorPago : num(pg.valor),
    descricao: pg.descricao,
    formaPagamento: pg.formaPagamento || '',
    dataPagamento: (pg.dataPagamento || hojeISO()).split('T')[0],
    pagadorNome: pg.pacienteNome || '',
    pagadorCpf: pg.pacienteCpf || '',
    pagadorEndereco: [pg.endereco, pg.cidade && `${pg.cidade}/${pg.estado || ''}`].filter(Boolean).join(' - '),
    dentistaNome: pg.dentistaNome || '',
    dentistaCro: pg.dentistaCro || '',
  });
};

/* ================================================================== *
 * EMISSÃO
 * ================================================================== */

exports.criar = (req, res) => {
  try {
    const {
      pacienteId, pagamentoId, dentistaId, valor, descricao, dataPagamento,
      formaPagamento, pagadorNome, pagadorCpf, pagadorEndereco, observacoes,
    } = req.body;

    if (!pacienteId) return res.status(400).json({ erro: 'Selecione o paciente', error: 'Selecione o paciente' });
    if (!descricao?.trim()) return res.status(400).json({ erro: 'Informe a descrição do serviço', error: 'Informe a descrição do serviço' });
    if (num(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor maior que zero', error: 'Informe um valor maior que zero' });

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    if (pagamentoId && !db.prepare('SELECT id FROM pagamentos WHERE id = ?').get(pagamentoId)) {
      return res.status(404).json({ erro: 'Pagamento não encontrado', error: 'Pagamento não encontrado' });
    }

    const dentista = dentistaId
      ? db.prepare('SELECT * FROM dentistas WHERE id = ?').get(dentistaId)
      : null;
    if (dentistaId && !dentista) {
      return res.status(404).json({ erro: 'Dentista não encontrado', error: 'Dentista não encontrado' });
    }

    const empresa = lerClinica();
    if (!empresa.razaoSocial?.trim()) {
      return res.status(400).json({
        erro: 'Cadastre os dados da empresa em Configurações antes de emitir recibos',
        error: 'Cadastre os dados da empresa em Configurações antes de emitir recibos',
      });
    }

    /* Congela os dados usados no documento: se a clínica mudar de endereço ou
       o paciente trocar de CPF, o recibo já emitido continua igual ao impresso. */
    const empresaSnapshot = {
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      documento: empresa.documento,
      tipoDocumento: empresa.tipoDocumento,
      cro: empresa.cro,
      responsavel: empresa.responsavel,
      endereco: empresa.endereco,
      bairro: empresa.bairro,
      cidade: empresa.cidade,
      estado: empresa.estado,
      cep: empresa.cep,
      telefone: empresa.telefone,
      email: empresa.email,
      site: empresa.site,
      logo: empresa.logo,
      observacaoRecibo: empresa.observacaoRecibo,
    };

    const pacienteSnapshot = {
      id: paciente.id,
      nome: paciente.nome,
      cpf: paciente.cpf,
      endereco: paciente.endereco,
      cidade: paciente.cidade,
      estado: paciente.estado,
      cep: paciente.cep,
      telefone: paciente.telefone,
    };

    const profissionalSnapshot = dentista
      ? { id: dentista.id, nome: dentista.nome, cro: dentista.cro, especialidade: dentista.especialidade }
      : (empresa.responsavel ? { nome: empresa.responsavel, cro: empresa.cro } : null);

    const data = (dataPagamento || hojeISO()).split('T')[0];
    const ano = anoDe(data);

    // Número sequencial por ano — em caso de emissão simultânea, tenta o seguinte
    let salvo = null;
    for (let tentativa = 0; tentativa < 5 && !salvo; tentativa++) {
      const numero = proximoNumero(ano);
      try {
        const r = db.prepare(`INSERT INTO recibos
            (numero, ano, pacienteId, pagamentoId, dentistaId, valor, descricao, dataPagamento,
             formaPagamento, pagadorNome, pagadorCpf, pagadorEndereco, observacoes,
             empresa, paciente, profissional, usuarioId, usuarioNome)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            numero, ano, pacienteId, pagamentoId || null, dentistaId || null,
            num(valor), descricao.trim(), data, formaPagamento || null,
            (pagadorNome || paciente.nome).trim(),
            soDigitos(pagadorCpf || paciente.cpf) || null,
            pagadorEndereco || null,
            observacoes || null,
            JSON.stringify(empresaSnapshot),
            JSON.stringify(pacienteSnapshot),
            profissionalSnapshot ? JSON.stringify(profissionalSnapshot) : null,
            req.usuario?.id || null,
            req.usuario?.nome || null,
          );
        salvo = db.prepare('SELECT * FROM recibos WHERE id = ?').get(r.lastInsertRowid);
      } catch (e) {
        if (!String(e.message).includes('UNIQUE')) throw e; // outro erro: sobe
      }
    }

    if (!salvo) {
      return res.status(409).json({ erro: 'Não foi possível gerar o número do recibo. Tente novamente.', error: 'Não foi possível gerar o número do recibo. Tente novamente.' });
    }

    const emitido = hidratar(salvo);
    registrarAuditoria(req, {
      entidade: 'recibo', entidadeId: emitido.id, acao: 'emitiu',
      descricao: `Recibo nº ${emitido.numeroFormatado} — ${emitido.pagadorNome} (R$ ${Number(emitido.valor).toFixed(2).replace('.', ',')})`,
      pacienteId: emitido.pacienteId, dentistaId: emitido.dentistaId,
    });
    res.status(201).json(emitido);
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/* ================================================================== *
 * CANCELAMENTO
 * Recibo não se apaga: cancela-se, mantendo o número usado.
 * ================================================================== */

exports.cancelar = (req, res) => {
  try {
    const r = db.prepare('SELECT * FROM recibos WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ erro: 'Recibo não encontrado', error: 'Recibo não encontrado' });
    if (r.cancelado) return res.status(400).json({ erro: 'Este recibo já está cancelado', error: 'Este recibo já está cancelado' });

    const { motivo } = req.body || {};
    db.prepare(`UPDATE recibos SET cancelado = 1, canceladoEm = datetime('now'),
                canceladoPor = ?, motivoCancelamento = ? WHERE id = ?`)
      .run(req.usuario?.nome || null, motivo || null, req.params.id);
    registrarAuditoria(req, {
      entidade: 'recibo', entidadeId: r.id, acao: 'cancelou',
      descricao: `Recibo nº ${numeroFormatado(r.numero, r.ano)} — ${r.pagadorNome}${motivo ? ` (motivo: ${motivo})` : ''}`,
      pacienteId: r.pacienteId, dentistaId: r.dentistaId,
    });

    res.json(hidratar(db.prepare('SELECT * FROM recibos WHERE id = ?').get(req.params.id)));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};
