const db = require('../database/db');

/**
 * AUDITORIA — "quem fez o quê"
 *
 * Duas camadas:
 *  1. Colunas criadoPor* / atualizadoPor* nos próprios registros
 *     (agenda, tratamentos e financeiro) — mostradas nas listas.
 *  2. Tabela `auditoria` com o log completo (inclui exclusões, que
 *     não deixam o registro para trás).
 *
 * As duas só chegam ao navegador do ADMIN: o middleware
 * `ocultarAuditoriaParaNaoAdmin` remove esses campos de qualquer
 * resposta JSON enviada a outros perfis. Assim nenhum controller
 * precisa lembrar de filtrar — e um campo novo não "vaza" por engano.
 */

const CAMPOS_AUDITORIA = ['criadoPorId', 'criadoPorNome', 'atualizadoPorId', 'atualizadoPorNome'];

/** { id, nome } do usuário logado (ou nulls quando não há login). */
const autor = (req) => ({
  id: req?.usuario?.id || null,
  nome: req?.usuario?.nome || null,
});

/**
 * Grava uma linha no log de auditoria. Nunca derruba a operação
 * principal: se falhar, só avisa no console.
 */
const registrarAuditoria = (req, { entidade, entidadeId = null, acao, descricao = null, pacienteId = null, dentistaId = null }) => {
  try {
    const u = autor(req);
    db.prepare(`INSERT INTO auditoria
      (usuarioId, usuarioNome, usuarioPerfil, entidade, entidadeId, acao, descricao, pacienteId, dentistaId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(u.id, u.nome, req?.usuario?.perfil || null, entidade, entidadeId,
        acao, descricao, pacienteId || null, dentistaId || null);
  } catch (e) {
    console.warn('⚠️  Falha ao registrar auditoria:', e.message);
  }
};

/** Remove os campos de auditoria de qualquer estrutura (objeto, lista, aninhados). */
const semAuditoria = (valor, profundidade = 0) => {
  if (profundidade > 6 || valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map((v) => semAuditoria(v, profundidade + 1));
  if (Buffer.isBuffer(valor) || valor instanceof Date) return valor;
  const limpo = {};
  for (const [k, v] of Object.entries(valor)) {
    if (CAMPOS_AUDITORIA.includes(k)) continue;
    limpo[k] = semAuditoria(v, profundidade + 1);
  }
  return limpo;
};

/**
 * Middleware global: para quem não é admin, os campos de auditoria
 * são retirados de todas as respostas JSON.
 * Precisa vir ANTES das rotas; o perfil é lido na hora da resposta
 * (depois que o middleware de autenticação da rota já rodou).
 */
const ocultarAuditoriaParaNaoAdmin = (req, res, next) => {
  const jsonOriginal = res.json.bind(res);
  res.json = (corpo) => {
    if (req.usuario?.perfil === 'admin') return jsonOriginal(corpo);
    return jsonOriginal(semAuditoria(corpo));
  };
  next();
};

module.exports = {
  CAMPOS_AUDITORIA,
  autor,
  registrarAuditoria,
  semAuditoria,
  ocultarAuditoriaParaNaoAdmin,
};
