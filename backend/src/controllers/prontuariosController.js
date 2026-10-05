const db = require('../database/db');
const { montarAlertas } = require('./anamneseController');
const { comImagens } = require('./tratamentosController');

/* ================================================================== *
 * PRONTUÁRIO AUTOMÁTICO
 * Monta o prontuário do paciente a partir do que já foi registrado no
 * sistema: atendimentos da agenda, tratamentos, odontograma (estado
 * atual + histórico), ortodontia, anamnese, termos assinados e as
 * anotações clínicas manuais (tabela prontuarios).
 * Nada é duplicado: o prontuário é sempre calculado na hora.
 * ================================================================== */

// Fuso da clínica (Brasil, sem horário de verão desde 2019)
const OFFSET = '-03:00';

// Só atendimentos CONCLUÍDOS entram no prontuário (agendados, confirmados,
// em atendimento, faltas e cancelados ficam de fora — ver aba Histórico).
const STATUS_ATENDIDO = ['concluido'];

const ROTULO_DENTE = {
  higido: 'Hígido', cariado: 'Cariado', restaurado: 'Restaurado', ausente: 'Ausente',
  indicado_extracao: 'Indicado p/ extração', protese: 'Prótese', tratamento_canal: 'Tratamento de canal',
  implante: 'Implante', selante: 'Selante', fraturado: 'Fraturado', em_tratamento: 'Em tratamento',
};
const ROTULO_FACE = { V: 'vestibular', L: 'lingual/palatina', M: 'mesial', D: 'distal', O: 'oclusal/incisal' };
const ROTULO_TRATAMENTO = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };

const rotuloDente = (s) => (s ? ROTULO_DENTE[s] || s : 'sem marcação');

/**
 * Converte as datas do banco em ISO com fuso, para ordenar e exibir certo:
 *  - 'YYYY-MM-DD'            → data local (meio-dia, só a data importa)
 *  - 'YYYY-MM-DD HH:MM:SS'   → gravado pelo SQLite em UTC
 *  - 'YYYY-MM-DDTHH:MM(:SS)' → digitado no formulário (hora local)
 */
const paraISO = (valor, hora) => {
  if (!valor) return null;
  const v = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T${hora ? `${hora.length === 5 ? `${hora}:00` : hora}` : '12:00:00'}${OFFSET}`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v)) return `${v.replace(' ', 'T')}Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return `${v}${OFFSET}`;
  return v;
};

/** '2026-09-24T18:07:14Z' → '24/09/2026' (no fuso da clínica). */
const dataBR = (valor, hora) => {
  const iso = paraISO(valor, hora);
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/** 18 + ['M','O'] → 'Dente 18 (M, O)'; sem dente → 'Boca inteira'. */
const alvoItem = (numeroDente, faces) => {
  if (!numeroDente) return 'Boca inteira';
  const lista = String(faces || '').split(',').filter(Boolean);
  return `Dente ${numeroDente}${lista.length ? ` (${lista.join(', ')})` : ''}`;
};

const soData = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '').trim());

const pacienteExiste = (id) => db.prepare('SELECT * FROM pacientes WHERE id = ? AND ativo = 1').get(id);

/**
 * GET /prontuarios/pacientes?busca=
 * Lista de pacientes com o resumo do prontuário de cada um.
 */
exports.listarPacientes = (req, res) => {
  try {
    const busca = `%${req.query.busca || ''}%`;
    const rows = db.prepare(`SELECT p.id, p.nome, p.cpf, p.dataNascimento, p.foto, p.telefone,
        (SELECT COUNT(*) FROM agendamentos a WHERE a.pacienteId = p.id AND a.status = 'concluido') AS atendimentos,
        (SELECT MAX(a.data) FROM agendamentos a WHERE a.pacienteId = p.id AND a.status = 'concluido') AS ultimoAtendimento,
        (SELECT COUNT(*) FROM tratamentos t WHERE t.pacienteId = p.id AND t.status IN ('nao_iniciado','em_andamento')) AS tratamentosAtivos,
        (SELECT COUNT(*) FROM tratamentos t WHERE t.pacienteId = p.id) AS tratamentos,
        (SELECT COUNT(*) FROM odontograma o WHERE o.pacienteId = p.id) AS marcacoesOdontograma,
        (SELECT COUNT(*) FROM prontuarios pr WHERE pr.pacienteId = p.id) AS anotacoes,
        (SELECT COUNT(*) FROM anamneses an WHERE an.pacienteId = p.id) AS temAnamnese
      FROM pacientes p
      WHERE p.ativo = 1 AND (p.nome LIKE ? OR IFNULL(p.cpf, '') LIKE ?)
      ORDER BY (ultimoAtendimento IS NULL), ultimoAtendimento DESC, p.nome`).all(busca, busca);
    res.json(rows.map((r) => ({ ...r, temAnamnese: Boolean(r.temAnamnese) })));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/**
 * GET /prontuarios/paciente/:pacienteId
 * Prontuário completo gerado automaticamente.
 */
exports.automatico = (req, res) => {
  try {
    const pacienteId = Number(req.params.pacienteId);
    const paciente = pacienteExiste(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });
    delete paciente.ativo;

    /* ------------------------- fontes de dados ------------------------- */
    const agendamentos = db.prepare(`SELECT a.*, d.nome AS dentistaNome, d.cro AS dentistaCro, pr.nome AS procedimentoNome
        FROM agendamentos a
        LEFT JOIN dentistas d ON a.dentistaId = d.id
        LEFT JOIN procedimentos pr ON a.procedimentoId = pr.id
        WHERE a.pacienteId = ? AND a.status IN (${STATUS_ATENDIDO.map(() => '?').join(',')})
        ORDER BY a.data, a.horaInicio`).all(pacienteId, ...STATUS_ATENDIDO);

    // Procedimentos do orçamento (odontograma) marcados como realizados ("Feito")
    let itensRealizados = [];
    try {
      itensRealizados = db.prepare(`SELECT id, numeroDente, faces, status, procedimento, observacoes, realizadoEm,
          updatedAt, criadoPorNome, atualizadoPorNome
          FROM orcamento_itens WHERE pacienteId = ? AND realizado = 1
          ORDER BY COALESCE(realizadoEm, updatedAt), id`).all(pacienteId);
    } catch { itensRealizados = []; }

    const tratamentos = db.prepare(`SELECT t.id, t.nome, t.descricao, t.valor, t.sessoes, t.sessoesRealizadas, t.status,
        t.dentistaId, t.imagens, t.createdAt, t.updatedAt, d.nome AS dentistaNome
        FROM tratamentos t LEFT JOIN dentistas d ON t.dentistaId = d.id
        WHERE t.pacienteId = ? ORDER BY t.createdAt`).all(pacienteId).map(comImagens);

    const odontoAtual = db.prepare(`SELECT o.numeroDente, o.face, o.status, o.procedimento, o.observacoes, o.updatedAt,
        d.nome AS dentistaNome
        FROM odontograma o LEFT JOIN dentistas d ON o.dentistaId = d.id
        WHERE o.pacienteId = ? ORDER BY o.numeroDente, o.face`).all(pacienteId);

    const odontoHistorico = db.prepare(`SELECT * FROM odontograma_historico WHERE pacienteId = ?
        ORDER BY createdAt, id`).all(pacienteId);

    const ficha = db.prepare(`SELECT f.*, d.nome AS dentistaNome FROM odontograma_ficha f
        LEFT JOIN dentistas d ON f.dentistaId = d.id WHERE f.pacienteId = ?`).get(pacienteId) || null;

    const ortodontia = db.prepare(`SELECT o.*, d.nome AS dentistaNome FROM ortodontia o
        LEFT JOIN dentistas d ON o.dentistaId = d.id
        WHERE o.pacienteId = ? ORDER BY date(o.data), o.id`).all(pacienteId);

    const anotacoes = db.prepare(`SELECT pr.*, d.nome AS dentistaNome, u.nome AS usuarioNome FROM prontuarios pr
        LEFT JOIN dentistas d ON pr.dentistaId = d.id
        LEFT JOIN usuarios u ON pr.usuarioId = u.id
        WHERE pr.pacienteId = ? ORDER BY pr.data`).all(pacienteId);

    const anamneseRow = db.prepare(`SELECT a.*, d.nome AS dentistaNome FROM anamneses a
        LEFT JOIN dentistas d ON a.dentistaId = d.id WHERE a.pacienteId = ?`).get(pacienteId);
    let anamnese = null;
    if (anamneseRow) {
      let respostas = {};
      try { respostas = JSON.parse(anamneseRow.respostas || '{}'); } catch { respostas = {}; }
      anamnese = {
        preenchidaEm: paraISO(anamneseRow.updatedAt),
        preenchidoPor: anamneseRow.preenchidoPor || null,
        dentistaNome: anamneseRow.dentistaNome || null,
        observacoes: anamneseRow.observacoes || null,
        alertas: montarAlertas(respostas),
      };
    }

    let termos = [];
    try {
      termos = db.prepare(`SELECT t.id, t.titulo, t.procedimento, t.status, t.formaAssinatura, t.assinanteNome,
          t.assinadoEm, t.revogadoEm, t.createdAt, d.nome AS dentistaNome
          FROM termos_consentimento t LEFT JOIN dentistas d ON t.dentistaId = d.id
          WHERE t.pacienteId = ? ORDER BY t.createdAt`).all(pacienteId);
    } catch { termos = []; }

    /* ------------------------- linha do tempo ------------------------- */
    const eventos = [];

    agendamentos.forEach((a) => {
      eventos.push({
        id: `ag-${a.id}`, tipo: 'atendimento', quando: paraISO(a.data, a.horaInicio),
        titulo: a.procedimentoNome || 'Consulta',
        subtitulo: `Atendimento concluído em ${dataBR(a.data)}`,
        dentista: a.dentistaNome || null,
        detalhes: [a.observacoes].filter(Boolean),
        referenciaId: a.id,
      });
    });

    itensRealizados.forEach((i) => {
      const quando = i.realizadoEm || i.updatedAt;
      eventos.push({
        id: `pr-${i.id}`, tipo: 'procedimento', quando: paraISO(quando),
        titulo: i.procedimento,
        subtitulo: `${alvoItem(i.numeroDente, i.faces)} — realizado em ${dataBR(quando)}`,
        dentista: null, responsavel: i.atualizadoPorNome || i.criadoPorNome || null,
        detalhes: [i.observacoes].filter(Boolean),
        referenciaId: i.id,
      });
    });

    tratamentos.forEach((t) => {
      eventos.push({
        id: `tr-${t.id}-ini`, tipo: 'tratamento', quando: paraISO(t.createdAt),
        titulo: t.nome, subtitulo: 'Tratamento registrado',
        dentista: t.dentistaNome || null,
        detalhes: [t.descricao !== t.nome && t.descricao, t.imagens.length && `${t.imagens.length} imagem(ns) na galeria`].filter(Boolean),
        referenciaId: t.id,
      });
      if (t.status === 'concluido' || t.status === 'cancelado') {
        eventos.push({
          id: `tr-${t.id}-fim`, tipo: 'tratamento', quando: paraISO(t.updatedAt),
          titulo: t.nome, subtitulo: t.status === 'concluido' ? 'Tratamento concluído' : 'Tratamento cancelado',
          dentista: t.dentistaNome || null,
          detalhes: [`${t.sessoesRealizadas}/${t.sessoes} sessões realizadas`],
          referenciaId: t.id,
        });
      }
    });

    // Histórico do odontograma agrupado por dia e por quem registrou
    const grupos = new Map();
    odontoHistorico.forEach((h) => {
      const iso = paraISO(h.createdAt);
      const dia = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const chave = `${dia}|${h.usuarioNome || ''}`;
      if (!grupos.has(chave)) grupos.set(chave, { quando: iso, usuario: h.usuarioNome, itens: [] });
      const g = grupos.get(chave);
      g.quando = iso; // guarda o horário da última alteração do dia
      const face = h.face ? ` (${ROTULO_FACE[h.face] || h.face})` : '';
      let texto;
      if (h.acao === 'remocao') texto = `Dente ${h.numeroDente}${face}: marcação removida (era ${rotuloDente(h.statusAnterior)})`;
      else if (h.acao === 'criacao' || !h.statusAnterior) texto = `Dente ${h.numeroDente}${face}: ${rotuloDente(h.statusNovo)}`;
      else texto = `Dente ${h.numeroDente}${face}: ${rotuloDente(h.statusAnterior)} → ${rotuloDente(h.statusNovo)}`;
      if (h.procedimento) texto += ` — ${h.procedimento}`;
      g.itens.push(texto);
    });
    [...grupos.values()].forEach((g, i) => {
      eventos.push({
        id: `od-${i}`, tipo: 'odontograma', quando: g.quando,
        titulo: 'Odontograma atualizado',
        subtitulo: `${g.itens.length} alteração(ões)`,
        dentista: null, responsavel: g.usuario || null,
        detalhes: g.itens,
      });
    });

    ortodontia.forEach((o) => {
      eventos.push({
        id: `or-${o.id}`, tipo: 'ortodontia', quando: paraISO(o.data), soData: soData(o.data),
        titulo: o.procedimento, subtitulo: o.tipoAparelho ? `Ortodontia — ${o.tipoAparelho}` : 'Ortodontia',
        dentista: o.dentistaNome || null,
        detalhes: [
          o.arcada && `Arcada: ${o.arcada}`,
          o.dentes && `Dentes: ${o.dentes}`,
          o.fioUtilizado && `Fio: ${o.fioUtilizado}`,
          o.elasticos && `Elásticos: ${o.elasticos}`,
          o.forcaAplicada && `Força aplicada: ${o.forcaAplicada}`,
          o.queixas && `Queixas: ${o.queixas}`,
          o.orientacoes && `Orientações: ${o.orientacoes}`,
          o.observacoes,
          o.proximaConsulta && `Próxima consulta: ${o.proximaConsulta.split('-').reverse().join('/')}`,
        ].filter(Boolean),
        referenciaId: o.id,
      });
    });

    const CAMPOS_ANOTACAO = [
      ['queixaPrincipal', 'Queixa principal'], ['historico', 'Histórico'], ['diagnostico', 'Diagnóstico'],
      ['observacoes', 'Observações clínicas'], ['evolucao', 'Evolução'], ['procedimentos', 'Procedimentos realizados'],
      ['medicamentos', 'Medicamentos prescritos'], ['anotacoes', 'Anotações'],
    ];
    anotacoes.forEach((a) => {
      eventos.push({
        id: `an-${a.id}`, tipo: 'anotacao', quando: paraISO(a.data), soData: soData(a.data),
        titulo: 'Anotação clínica', subtitulo: a.diagnostico ? `Diagnóstico: ${a.diagnostico}` : null,
        dentista: a.dentistaNome || null, responsavel: a.usuarioNome || null,
        campos: CAMPOS_ANOTACAO.filter(([k]) => a[k]).map(([k, rotulo]) => ({ rotulo, texto: a[k] })),
        detalhes: [],
        referenciaId: a.id,
        editavel: true,
      });
    });

    if (anamneseRow) {
      eventos.push({
        id: 'anamnese', tipo: 'anamnese', quando: paraISO(anamneseRow.updatedAt),
        titulo: 'Anamnese atualizada',
        subtitulo: anamnese.alertas.length ? `${anamnese.alertas.length} alerta(s) clínico(s)` : 'Sem alertas clínicos',
        dentista: anamneseRow.dentistaNome || null, responsavel: anamneseRow.preenchidoPor || null,
        detalhes: anamnese.alertas.map((al) => `${al.pergunta}${al.detalhe ? ` — ${al.detalhe}` : ''}`),
      });
    }

    termos.filter((t) => t.assinadoEm).forEach((t) => {
      eventos.push({
        id: `te-${t.id}`, tipo: 'termo', quando: paraISO(t.assinadoEm),
        titulo: t.titulo,
        subtitulo: t.status === 'revogado' ? 'Termo assinado (depois revogado)' : 'Termo assinado',
        dentista: t.dentistaNome || null,
        detalhes: [t.procedimento && `Procedimento: ${t.procedimento}`, t.assinanteNome && `Assinado por: ${t.assinanteNome}`].filter(Boolean),
        referenciaId: t.id,
      });
    });

    eventos.sort((a, b) => (Date.parse(b.quando) || 0) - (Date.parse(a.quando) || 0));

    /* ----------------------------- resumo ----------------------------- */
    const atendidos = agendamentos; // a consulta já traz só os concluídos

    // Procedimentos realizados: itens "Feito" do orçamento + atendimentos concluídos da agenda
    const procedimentosRealizados = [
      ...itensRealizados.map((i) => {
        const quando = i.realizadoEm || i.updatedAt;
        return {
          id: `orc-${i.id}`, origem: 'orcamento', procedimento: i.procedimento,
          alvo: alvoItem(i.numeroDente, i.faces), numeroDente: i.numeroDente,
          faces: i.faces ? i.faces.split(',') : [],
          realizadoEm: paraISO(quando), dataTexto: dataBR(quando),
          responsavel: i.atualizadoPorNome || i.criadoPorNome || null, dentista: null,
          observacoes: i.observacoes || null,
        };
      }),
      ...agendamentos.map((a) => ({
        id: `ag-${a.id}`, origem: 'agenda', procedimento: a.procedimentoNome || 'Consulta',
        alvo: null, numeroDente: null, faces: [],
        realizadoEm: paraISO(a.data, a.horaInicio), dataTexto: dataBR(a.data),
        responsavel: null, dentista: a.dentistaNome || null,
        observacoes: a.observacoes || null,
      })),
    ].sort((a, b) => (Date.parse(b.realizadoEm) || 0) - (Date.parse(a.realizadoEm) || 0));

    const dentistas = [...new Set([
      ...atendidos.map((a) => a.dentistaNome),
      ...tratamentos.map((t) => t.dentistaNome),
      ...ortodontia.map((o) => o.dentistaNome),
      ...anotacoes.map((a) => a.dentistaNome),
    ].filter(Boolean))];

    // Estado atual do odontograma, por dente
    const porDente = {};
    odontoAtual.forEach((o) => {
      porDente[o.numeroDente] = porDente[o.numeroDente] || { numeroDente: o.numeroDente, marcacoes: [] };
      const feito = o.procedimento ? itensRealizados.find((i) => i.numeroDente === o.numeroDente
        && String(i.procedimento).trim().toLowerCase() === String(o.procedimento).trim().toLowerCase()
        && (!o.face || !i.faces || i.faces.split(',').includes(o.face))) : null;
      porDente[o.numeroDente].marcacoes.push({
        face: o.face, faceRotulo: o.face ? ROTULO_FACE[o.face] || o.face : null,
        status: o.status, statusRotulo: o.status ? rotuloDente(o.status) : null,
        procedimento: o.procedimento, observacoes: o.observacoes,
        realizadoEm: feito ? dataBR(feito.realizadoEm || feito.updatedAt) : null,
      });
    });
    const resumoOdonto = {};
    odontoAtual.forEach((o) => {
      if (!o.status) return;
      resumoOdonto[o.status] = resumoOdonto[o.status] || { status: o.status, rotulo: rotuloDente(o.status), dentes: new Set() };
      resumoOdonto[o.status].dentes.add(o.numeroDente);
    });

    const alertasFicha = ficha?.alertas ? String(ficha.alertas).split(/\n+/).map((x) => x.trim()).filter(Boolean) : [];

    res.json({
      geradoEm: new Date().toISOString(),
      paciente,
      alertas: [
        ...(anamnese?.alertas || []).map((a) => `${a.pergunta}${a.detalhe ? ` — ${a.detalhe}` : ''}`),
        ...alertasFicha,
      ],
      ficha: ficha ? {
        queixaPrincipal: ficha.queixaPrincipal, anamnese: ficha.anamnese,
        observacoesGerais: ficha.observacoesGerais, dentistaNome: ficha.dentistaNome,
        atualizadoEm: paraISO(ficha.updatedAt),
      } : null,
      anamnese,
      resumo: {
        totalAtendimentos: atendidos.length,
        totalProcedimentosRealizados: procedimentosRealizados.length,
        primeiroAtendimento: atendidos[0]?.data || null,
        ultimoAtendimento: atendidos[atendidos.length - 1]?.data || null,
        tratamentos: {
          total: tratamentos.length,
          ativos: tratamentos.filter((t) => ['nao_iniciado', 'em_andamento'].includes(t.status)).length,
          concluidos: tratamentos.filter((t) => t.status === 'concluido').length,
        },
        dentistas,
        termosAssinados: termos.filter((t) => t.status === 'assinado').length,
        termosPendentes: termos.filter((t) => t.status === 'pendente').length,
      },
      procedimentosRealizados,
      tratamentos: tratamentos.map((t) => ({ ...t, statusRotulo: ROTULO_TRATAMENTO[t.status] || t.status })).reverse(),
      odontograma: {
        dentes: Object.values(porDente),
        resumo: Object.values(resumoOdonto).map((r) => ({ ...r, dentes: [...r.dentes].sort((a, b) => a - b) })),
        totalMarcacoes: odontoAtual.length,
      },
      eventos,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/* ================================================================== *
 * ANOTAÇÕES CLÍNICAS MANUAIS (complementam o prontuário automático)
 * ================================================================== */


exports.listar = (req, res) => {
  const { pacienteId } = req.query;
  let sql = "SELECT pr.*, p.nome as pacienteNome, d.nome as dentistaNome FROM prontuarios pr LEFT JOIN pacientes p ON pr.pacienteId = p.id LEFT JOIN dentistas d ON pr.dentistaId = d.id WHERE 1=1";
  const params = [];
  if (pacienteId) { sql += ' AND pr.pacienteId = ?'; params.push(pacienteId); }
  sql += ' ORDER BY pr.data DESC';
  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => {
    r.paciente = { id: r.pacienteId, nome: r.pacienteNome }; delete r.pacienteNome;
    r.dentista = { nome: r.dentistaNome }; delete r.dentistaNome;
  });
  res.json(rows);
};

exports.buscarPorId = (req, res) => {
  const pr = db.prepare("SELECT pr.*, p.nome as pacienteNome, d.nome as dentistaNome FROM prontuarios pr LEFT JOIN pacientes p ON pr.pacienteId = p.id LEFT JOIN dentistas d ON pr.dentistaId = d.id WHERE pr.id = ?").get(req.params.id);
  if (!pr) return res.status(404).json({ erro: 'Prontuário não encontrado' });
  pr.paciente = { id: pr.pacienteId, nome: pr.pacienteNome }; delete pr.pacienteNome;
  pr.dentista = { nome: pr.dentistaNome }; delete pr.dentistaNome;
  res.json(pr);
};

exports.criar = (req, res) => {
  try {
    const { pacienteId, dentistaId, queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes, data } = req.body;
    if (!pacienteId) return res.status(400).json({ erro: 'Paciente é obrigatório', error: 'Paciente é obrigatório' });
    if (![queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes].some((v) => v && String(v).trim())) {
      return res.status(400).json({ erro: 'Preencha ao menos um campo da anotação', error: 'Preencha ao menos um campo da anotação' });
    }
    const r = db.prepare("INSERT INTO prontuarios (pacienteId, dentistaId, usuarioId, queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))").run(pacienteId, dentistaId||null, req.usuario.id, queixaPrincipal||null, historico||null, diagnostico||null, observacoes||null, evolucao||null, procedimentos||null, medicamentos||null, anotacoes||null, data||null);
    res.status(201).json(db.prepare('SELECT * FROM prontuarios WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

const CAMPOS_TEXTO = ['queixaPrincipal', 'historico', 'diagnostico', 'observacoes', 'evolucao', 'procedimentos', 'medicamentos', 'anotacoes'];

exports.atualizar = (req, res) => {
  try {
    const { id } = req.params;
    const pr = db.prepare('SELECT * FROM prontuarios WHERE id = ?').get(id);
    if (!pr) return res.status(404).json({ erro: 'Prontuário não encontrado' });
    const { queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes, data, dentistaId } = req.body;
    db.prepare("UPDATE prontuarios SET dentistaId=?, queixaPrincipal=?, historico=?, diagnostico=?, observacoes=?, evolucao=?, procedimentos=?, medicamentos=?, anotacoes=?, data=?, updatedAt=datetime('now') WHERE id=?")
      .run(dentistaId !== undefined ? (dentistaId || null) : pr.dentistaId,
        ...[queixaPrincipal, historico, diagnostico, observacoes, evolucao, procedimentos, medicamentos, anotacoes]
          .map((v, i) => (v !== undefined ? (v || null) : pr[CAMPOS_TEXTO[i]])),
        data || pr.data, id);
    res.json(db.prepare('SELECT * FROM prontuarios WHERE id = ?').get(id));
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};

exports.excluir = (req, res) => {
  const pr = db.prepare('SELECT id FROM prontuarios WHERE id = ?').get(req.params.id);
  if (!pr) return res.status(404).json({ erro: 'Prontuário não encontrado' });
  db.prepare('DELETE FROM prontuarios WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Prontuário excluído' });
};
