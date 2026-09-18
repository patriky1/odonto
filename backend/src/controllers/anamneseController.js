const db = require('../database/db');

/* ================================================================== *
 * QUESTIONÁRIO PADRÃO DE ANAMNESE ODONTOLÓGICA
 * tipo: 'sim_nao'  → Sim/Não (+ campo de detalhe quando "Sim")
 *       'texto'    → resposta livre curta
 *       'textarea' → resposta livre longa
 *       'opcoes'   → lista de opções
 * ================================================================== */

const QUESTIONARIO = [
  {
    secao: 'Saúde geral',
    perguntas: [
      { id: 'tratamento_medico', texto: 'Está sob tratamento médico atualmente?', tipo: 'sim_nao', detalhe: 'Qual tratamento?' },
      { id: 'doenca_grave', texto: 'Tem ou teve alguma doença grave?', tipo: 'sim_nao', detalhe: 'Qual?' },
      { id: 'medicamentos', texto: 'Faz uso contínuo de algum medicamento?', tipo: 'sim_nao', detalhe: 'Quais medicamentos e doses?' },
      { id: 'alergia_medicamento', texto: 'Tem alergia a algum medicamento?', tipo: 'sim_nao', detalhe: 'Quais?', alerta: true },
      { id: 'alergia_anestesia', texto: 'Já teve reação a anestesia odontológica?', tipo: 'sim_nao', detalhe: 'Descreva a reação', alerta: true },
      { id: 'alergia_latex', texto: 'Tem alergia a látex ou outros materiais?', tipo: 'sim_nao', detalhe: 'Quais?', alerta: true },
      { id: 'internacao', texto: 'Já foi internado ou passou por cirurgia?', tipo: 'sim_nao', detalhe: 'Motivo e quando' },
    ],
  },
  {
    secao: 'Condições específicas',
    perguntas: [
      { id: 'pressao', texto: 'Pressão arterial', tipo: 'opcoes', opcoes: ['Normal', 'Alta (hipertensão)', 'Baixa (hipotensão)', 'Não sei'] },
      { id: 'diabetes', texto: 'É diabético?', tipo: 'sim_nao', detalhe: 'Tipo e controle', alerta: true },
      { id: 'cardiaco', texto: 'Tem problema cardíaco ou usa marca-passo?', tipo: 'sim_nao', detalhe: 'Qual?', alerta: true },
      { id: 'anticoagulante', texto: 'Usa anticoagulante (ex.: varfarina, AAS)?', tipo: 'sim_nao', detalhe: 'Qual e desde quando?', alerta: true },
      { id: 'hemorragia', texto: 'Tem dificuldade de cicatrização ou sangramento prolongado?', tipo: 'sim_nao', detalhe: 'Descreva', alerta: true },
      { id: 'respiratorio', texto: 'Tem asma, bronquite ou outro problema respiratório?', tipo: 'sim_nao', detalhe: 'Qual?' },
      { id: 'renal_hepatico', texto: 'Tem problema renal ou hepático?', tipo: 'sim_nao', detalhe: 'Qual?' },
      { id: 'osteoporose', texto: 'Tem osteoporose ou usa bifosfonatos?', tipo: 'sim_nao', detalhe: 'Qual medicação?', alerta: true },
      { id: 'epilepsia', texto: 'Tem epilepsia ou convulsões?', tipo: 'sim_nao', detalhe: 'Frequência e medicação', alerta: true },
      { id: 'gravidez', texto: 'Está grávida ou amamentando?', tipo: 'sim_nao', detalhe: 'Tempo de gestação', alerta: true },
    ],
  },
  {
    secao: 'Hábitos',
    perguntas: [
      { id: 'fumante', texto: 'É fumante?', tipo: 'sim_nao', detalhe: 'Quantidade por dia' },
      { id: 'alcool', texto: 'Consome bebida alcoólica com frequência?', tipo: 'sim_nao', detalhe: 'Frequência' },
      { id: 'bruxismo', texto: 'Range ou aperta os dentes (bruxismo)?', tipo: 'sim_nao', detalhe: 'Dia ou noite?' },
      { id: 'roer_unhas', texto: 'Tem o hábito de roer unhas ou morder objetos?', tipo: 'sim_nao' },
      { id: 'respirador_bucal', texto: 'Respira predominantemente pela boca?', tipo: 'sim_nao' },
    ],
  },
  {
    secao: 'Histórico odontológico',
    perguntas: [
      { id: 'ultima_consulta', texto: 'Data aproximada da última consulta odontológica', tipo: 'texto' },
      { id: 'experiencia_ruim', texto: 'Já teve experiência traumática em tratamento dentário?', tipo: 'sim_nao', detalhe: 'Descreva' },
      { id: 'sangramento_gengival', texto: 'A gengiva sangra ao escovar?', tipo: 'sim_nao' },
      { id: 'sensibilidade', texto: 'Sente sensibilidade a alimentos quentes, frios ou doces?', tipo: 'sim_nao', detalhe: 'Onde?' },
      { id: 'dor_atm', texto: 'Sente dor ou estalo na articulação da mandíbula (ATM)?', tipo: 'sim_nao', detalhe: 'Descreva' },
      { id: 'ortodontia_previa', texto: 'Já usou aparelho ortodôntico?', tipo: 'sim_nao', detalhe: 'Quando e por quanto tempo' },
      { id: 'protese', texto: 'Usa algum tipo de prótese?', tipo: 'sim_nao', detalhe: 'Qual?' },
      { id: 'escovacoes', texto: 'Quantas vezes escova os dentes por dia?', tipo: 'opcoes', opcoes: ['1x', '2x', '3x ou mais', 'Não escovo diariamente'] },
      { id: 'fio_dental', texto: 'Usa fio dental?', tipo: 'opcoes', opcoes: ['Diariamente', 'Às vezes', 'Nunca'] },
    ],
  },
  {
    secao: 'Motivo da consulta',
    perguntas: [
      { id: 'queixa_principal', texto: 'Queixa principal / motivo da consulta', tipo: 'textarea' },
      { id: 'expectativa', texto: 'O que espera do tratamento?', tipo: 'textarea' },
    ],
  },
];

/** IDs das perguntas que geram alerta clínico quando respondidas "Sim". */
const IDS_ALERTA = QUESTIONARIO.flatMap((s) => s.perguntas.filter((p) => p.alerta).map((p) => p.id));

exports.questionario = (req, res) => res.json(QUESTIONARIO);

/** Monta a lista de alertas a partir das respostas marcadas como "Sim". */
const montarAlertas = (respostas) => {
  const rotulos = {};
  QUESTIONARIO.forEach((s) => s.perguntas.forEach((p) => { rotulos[p.id] = p.texto; }));
  return IDS_ALERTA
    .filter((id) => respostas?.[id]?.valor === 'sim')
    .map((id) => ({ id, pergunta: rotulos[id], detalhe: respostas[id]?.detalhe || null }));
};

exports.buscar = (req, res) => {
  try {
    const { pacienteId } = req.params;
    const paciente = db.prepare('SELECT id, nome FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const row = db.prepare(`SELECT a.*, d.nome AS dentistaNome FROM anamneses a
                            LEFT JOIN dentistas d ON a.dentistaId = d.id
                            WHERE a.pacienteId = ?`).get(pacienteId);
    if (!row) {
      return res.json({ pacienteId: Number(pacienteId), respostas: {}, observacoes: null, alertas: [], preenchida: false });
    }
    let respostas = {};
    try { respostas = JSON.parse(row.respostas || '{}'); } catch { respostas = {}; }

    res.json({ ...row, respostas, alertas: montarAlertas(respostas), preenchida: true });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.salvar = (req, res) => {
  try {
    const { pacienteId } = req.params;
    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const { respostas = {}, observacoes, dentistaId } = req.body;
    if (typeof respostas !== 'object' || Array.isArray(respostas)) {
      return res.status(400).json({ erro: 'Formato de respostas inválido', error: 'Formato de respostas inválido' });
    }

    // Guarda apenas perguntas conhecidas (evita lixo no banco)
    const validos = new Set(QUESTIONARIO.flatMap((s) => s.perguntas.map((p) => p.id)));
    const limpas = {};
    for (const [k, v] of Object.entries(respostas)) {
      if (!validos.has(k)) continue;
      limpas[k] = { valor: v?.valor ?? null, detalhe: v?.detalhe || null };
    }

    const json = JSON.stringify(limpas);
    const existe = db.prepare('SELECT pacienteId FROM anamneses WHERE pacienteId = ?').get(pacienteId);

    if (existe) {
      db.prepare(`UPDATE anamneses SET respostas=?, observacoes=?, dentistaId=?, preenchidoPor=?,
                  updatedAt=datetime('now') WHERE pacienteId=?`)
        .run(json, observacoes || null, dentistaId || null, req.usuario?.nome || null, pacienteId);
    } else {
      db.prepare(`INSERT INTO anamneses (pacienteId, respostas, observacoes, dentistaId, preenchidoPor)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(pacienteId, json, observacoes || null, dentistaId || null, req.usuario?.nome || null);
    }

    const salva = db.prepare('SELECT * FROM anamneses WHERE pacienteId = ?').get(pacienteId);
    res.json({ ...salva, respostas: limpas, alertas: montarAlertas(limpas), preenchida: true });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.excluir = (req, res) => {
  const { pacienteId } = req.params;
  const existe = db.prepare('SELECT pacienteId FROM anamneses WHERE pacienteId = ?').get(pacienteId);
  if (!existe) return res.status(404).json({ erro: 'Anamnese não encontrada', error: 'Anamnese não encontrada' });
  db.prepare('DELETE FROM anamneses WHERE pacienteId = ?').run(pacienteId);
  res.json({ mensagem: 'Anamnese removida' });
};
