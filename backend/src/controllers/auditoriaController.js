const db = require('../database/db');

/**
 * Registro de atividades (somente admin).
 * Filtros: entidade, usuarioId, pacienteId, acao, inicio, fim (YYYY-MM-DD), busca.
 * Paginação: pagina (1..n), limite (máx. 200).
 */
exports.listar = (req, res) => {
  try {
    const { entidade, usuarioId, pacienteId, acao, inicio, fim, busca } = req.query;
    const limite = Math.min(Math.max(parseInt(req.query.limite) || 50, 1), 200);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);

    let where = ' WHERE 1=1';
    const params = [];
    if (entidade) { where += ' AND a.entidade = ?'; params.push(entidade); }
    if (usuarioId) { where += ' AND a.usuarioId = ?'; params.push(usuarioId); }
    if (pacienteId) { where += ' AND a.pacienteId = ?'; params.push(pacienteId); }
    if (acao) { where += ' AND a.acao = ?'; params.push(acao); }
    // createdAt é gravado em UTC; o filtro por dia usa o horário de Brasília (-3h)
    if (inicio) { where += " AND date(a.createdAt, '-3 hours') >= date(?)"; params.push(inicio); }
    if (fim) { where += " AND date(a.createdAt, '-3 hours') <= date(?)"; params.push(fim); }
    if (busca) {
      where += " AND (IFNULL(a.descricao, '') LIKE ? OR IFNULL(a.usuarioNome, '') LIKE ?)";
      params.push(`%${busca}%`, `%${busca}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) AS c FROM auditoria a${where}`).get(...params).c;
    const registros = db.prepare(`SELECT a.*, p.nome AS pacienteNome, d.nome AS dentistaNome
      FROM auditoria a
      LEFT JOIN pacientes p ON a.pacienteId = p.id
      LEFT JOIN dentistas d ON a.dentistaId = d.id
      ${where}
      ORDER BY a.createdAt DESC, a.id DESC
      LIMIT ? OFFSET ?`).all(...params, limite, (pagina - 1) * limite);

    res.json({ registros, total, pagina, totalPaginas: Math.max(1, Math.ceil(total / limite)) });
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Histórico de um registro específico (ex.: /auditoria/agendamento/12). */
exports.historicoDoRegistro = (req, res) => {
  try {
    const registros = db.prepare(`SELECT * FROM auditoria WHERE entidade = ? AND entidadeId = ?
                                  ORDER BY createdAt DESC, id DESC`).all(req.params.entidade, req.params.id);
    res.json(registros);
  } catch (e) {
    res.status(500).json({ erro: e.message, error: e.message });
  }
};

/** Resumo para os filtros da tela: quem já registrou algo e quais ações existem. */
exports.opcoes = (req, res) => {
  const usuarios = db.prepare(`SELECT DISTINCT usuarioId AS id, usuarioNome AS nome FROM auditoria
                               WHERE usuarioId IS NOT NULL ORDER BY usuarioNome`).all();
  const acoes = db.prepare('SELECT DISTINCT acao FROM auditoria ORDER BY acao').all().map((r) => r.acao);
  res.json({ usuarios, acoes });
};
