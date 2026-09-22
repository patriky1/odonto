const db = require('../database/db');

/**
 * Retorna o registro de dentista vinculado ao usuário autenticado.
 * O vínculo é feito pela coluna dentistas.usuarioId; se ela ainda não
 * estiver preenchida, tenta casar por e-mail e depois por nome.
 */
const dentistaDoUsuario = (usuario) => {
  if (!usuario) return null;

  let d = db.prepare('SELECT * FROM dentistas WHERE usuarioId = ? AND ativo = 1').get(usuario.id);
  if (d) return d;

  if (usuario.email) {
    d = db.prepare('SELECT * FROM dentistas WHERE lower(email) = lower(?) AND ativo = 1').get(usuario.email);
    if (d) return d;
  }

  d = db.prepare('SELECT * FROM dentistas WHERE lower(nome) = lower(?) AND ativo = 1').get(usuario.nome);
  return d || null;
};

/**
 * Define o escopo da agenda de acordo com o perfil:
 *
 *   admin         → vê todos os dentistas (pode filtrar por um)
 *   recepcionista → igual ao admin: vê todos por padrão (pode filtrar por um)
 *   dentista      → vê apenas os próprios agendamentos (filtro obrigatório)
 *
 * Retorna { dentistaId, exigeSelecao, dentista }.
 * `exigeSelecao` foi mantido por compatibilidade e hoje é sempre false.
 */
const escopoAgenda = (usuario, dentistaIdSolicitado) => {
  const perfil = usuario?.perfil;

  if (perfil === 'dentista') {
    const dentista = dentistaDoUsuario(usuario);
    // Dentista sem cadastro vinculado não enxerga agenda nenhuma
    return { dentistaId: dentista ? dentista.id : -1, exigeSelecao: false, dentista, bloqueado: !dentista };
  }

  // admin, recepcionista e demais perfis: todos os dentistas, com filtro opcional
  const id = dentistaIdSolicitado ? parseInt(dentistaIdSolicitado) : null;
  return { dentistaId: id, exigeSelecao: false, dentista: null };
};

/** Verifica se o usuário pode acessar/alterar um agendamento específico. */
const podeVerAgendamento = (usuario, agendamento) => {
  if (!agendamento) return false;
  if (usuario?.perfil !== 'dentista') return true;
  const dentista = dentistaDoUsuario(usuario);
  return !!dentista && agendamento.dentistaId === dentista.id;
};

module.exports = { dentistaDoUsuario, escopoAgenda, podeVerAgendamento };
