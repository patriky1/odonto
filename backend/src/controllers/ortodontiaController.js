const db = require('../database/db');

const TIPOS_APARELHO = [
  'Fixo metálico', 'Fixo estético (cerâmica/safira)', 'Autoligado', 'Lingual',
  'Alinhadores transparentes', 'Removível', 'Expansor palatino', 'Aparelho extrabucal',
  'Mantenedor de espaço', 'Contenção',
];

const PROCEDIMENTOS = [
  'Instalação de aparelho', 'Manutenção mensal', 'Troca de fio', 'Colagem de bráquete',
  'Recolagem de bráquete', 'Instalação de banda', 'Ativação de expansor',
  'Instalação de elásticos', 'Remoção de aparelho', 'Instalação de contenção',
  'Moldagem / escaneamento', 'Documentação ortodôntica', 'Ajuste / reparo', 'Outro',
];

const ARCADAS = ['Superior', 'Inferior', 'Ambas'];

exports.opcoes = (req, res) => res.json({
  tiposAparelho: TIPOS_APARELHO,
  procedimentos: PROCEDIMENTOS,
  arcadas: ARCADAS,
});

exports.listar = (req, res) => {
  try {
    const { pacienteId } = req.params;
    const paciente = db.prepare('SELECT id, nome FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const registros = db.prepare(`SELECT o.*, d.nome AS dentistaNome FROM ortodontia o
                                  LEFT JOIN dentistas d ON o.dentistaId = d.id
                                  WHERE o.pacienteId = ? ORDER BY date(o.data) DESC, o.id DESC`).all(pacienteId);

    const totalInvestido = registros.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
    const emAndamento = registros.find((r) => r.tipoAparelho) || null;

    res.json({
      paciente,
      registros,
      total: registros.length,
      totalInvestido,
      aparelhoAtual: emAndamento?.tipoAparelho || null,
      proximaConsulta: registros.map((r) => r.proximaConsulta).filter(Boolean).sort()[0] || null,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.criar = (req, res) => {
  try {
    const { pacienteId } = req.params;
    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado', error: 'Paciente não encontrado' });

    const b = req.body;
    if (!b.procedimento?.trim()) {
      return res.status(400).json({ erro: 'Informe o procedimento realizado', error: 'Informe o procedimento realizado' });
    }

    const dentes = Array.isArray(b.dentes) ? b.dentes.join(',') : (b.dentes || null);

    const r = db.prepare(`INSERT INTO ortodontia
      (pacienteId, dentistaId, data, tipoAparelho, procedimento, arcada, dentes, fioUtilizado, elasticos,
       forcaAplicada, queixas, orientacoes, proximaConsulta, valor, observacoes, usuarioId, usuarioNome)
      VALUES (?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pacienteId, b.dentistaId || null, b.data || null, b.tipoAparelho || null,
        b.procedimento.trim(), b.arcada || null, dentes, b.fioUtilizado || null, b.elasticos || null,
        b.forcaAplicada || null, b.queixas || null, b.orientacoes || null, b.proximaConsulta || null,
        b.valor !== undefined && b.valor !== '' ? parseFloat(b.valor) : null,
        b.observacoes || null, req.usuario?.id || null, req.usuario?.nome || null);

    res.status(201).json(db.prepare('SELECT * FROM ortodontia WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.atualizar = (req, res) => {
  try {
    const reg = db.prepare('SELECT * FROM ortodontia WHERE id = ?').get(req.params.id);
    if (!reg) return res.status(404).json({ erro: 'Registro não encontrado', error: 'Registro não encontrado' });

    const b = req.body;
    const dentes = b.dentes !== undefined
      ? (Array.isArray(b.dentes) ? b.dentes.join(',') : (b.dentes || null))
      : reg.dentes;

    db.prepare(`UPDATE ortodontia SET dentistaId=?, data=?, tipoAparelho=?, procedimento=?, arcada=?, dentes=?,
                fioUtilizado=?, elasticos=?, forcaAplicada=?, queixas=?, orientacoes=?, proximaConsulta=?,
                valor=?, observacoes=?, updatedAt=datetime('now') WHERE id=?`)
      .run(
        b.dentistaId !== undefined ? (b.dentistaId || null) : reg.dentistaId,
        b.data ?? reg.data,
        b.tipoAparelho !== undefined ? (b.tipoAparelho || null) : reg.tipoAparelho,
        b.procedimento ?? reg.procedimento,
        b.arcada !== undefined ? (b.arcada || null) : reg.arcada,
        dentes,
        b.fioUtilizado !== undefined ? (b.fioUtilizado || null) : reg.fioUtilizado,
        b.elasticos !== undefined ? (b.elasticos || null) : reg.elasticos,
        b.forcaAplicada !== undefined ? (b.forcaAplicada || null) : reg.forcaAplicada,
        b.queixas !== undefined ? (b.queixas || null) : reg.queixas,
        b.orientacoes !== undefined ? (b.orientacoes || null) : reg.orientacoes,
        b.proximaConsulta !== undefined ? (b.proximaConsulta || null) : reg.proximaConsulta,
        b.valor !== undefined ? (b.valor === '' ? null : parseFloat(b.valor)) : reg.valor,
        b.observacoes !== undefined ? (b.observacoes || null) : reg.observacoes,
        req.params.id
      );

    res.json(db.prepare('SELECT * FROM ortodontia WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

exports.excluir = (req, res) => {
  const reg = db.prepare('SELECT id FROM ortodontia WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ erro: 'Registro não encontrado', error: 'Registro não encontrado' });
  db.prepare('DELETE FROM ortodontia WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Registro removido' });
};
