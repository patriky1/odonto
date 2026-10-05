const bcrypt = require('bcryptjs');
const db = require('../database/db');
const backup = require('../utils/backup');
const { registrarAuditoria } = require('../utils/auditoria');

const falha = (res, e) => {
  const status = e.statusCode || 500;
  res.status(status).json({ erro: e.message, error: e.message });
};

/** Lista dos backups + configuração do backup automático. */
exports.listar = (req, res) => {
  try {
    res.json({
      backups: backup.listarBackups(),
      config: backup.configBackup(),
      intervalosHoras: backup.INTERVALOS_HORAS,
      ultimoAutomatico: backup.ultimoAutomatico()?.criadoEm || null,
      proximoAutomatico: backup.proximoAutomatico(),
      pasta: backup.PASTA,
    });
  } catch (e) {
    falha(res, e);
  }
};

exports.criar = (req, res) => {
  try {
    const novo = backup.criarBackup('manual');
    registrarAuditoria(req, { entidade: 'backup', acao: 'criou', descricao: `Backup manual ${novo.arquivo}` });
    res.status(201).json(novo);
  } catch (e) {
    falha(res, e);
  }
};

/** Substitui os dados atuais pelos do backup. Exige a senha de login de quem pede. */
exports.restaurar = async (req, res) => {
  try {
    const { senha } = req.body || {};
    if (!senha) {
      return res.status(400).json({ erro: 'Informe sua senha de acesso para confirmar', error: 'Informe sua senha de acesso para confirmar' });
    }
    const usuario = db.prepare('SELECT senha FROM usuarios WHERE id = ?').get(req.usuario.id);
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(403).json({ erro: 'Senha incorreta', error: 'Senha incorreta' }); // 403, não 401: o login continua válido
    }

    const resultado = backup.restaurarBackup(req.params.arquivo);
    // Registrado depois: a tabela de auditoria também volta ao estado do backup
    registrarAuditoria(req, {
      entidade: 'backup',
      acao: 'restaurou',
      descricao: `Banco restaurado a partir de ${resultado.arquivoRestaurado} (estado anterior salvo em ${resultado.backupDeSeguranca})`,
    });
    console.log(`♻️  Banco restaurado a partir de ${resultado.arquivoRestaurado} por ${req.usuario.nome}`);
    res.json({ ...resultado, mensagem: 'Backup restaurado com sucesso' });
  } catch (e) {
    falha(res, e);
  }
};

exports.excluir = (req, res) => {
  try {
    backup.excluirBackup(req.params.arquivo);
    registrarAuditoria(req, { entidade: 'backup', acao: 'excluiu', descricao: `Backup ${req.params.arquivo}` });
    res.json({ mensagem: 'Backup excluído' });
  } catch (e) {
    falha(res, e);
  }
};

exports.salvarConfiguracao = (req, res) => {
  try {
    const config = backup.salvarConfigBackup(req.body || {}, req.usuario.nome);
    registrarAuditoria(req, {
      entidade: 'backup',
      acao: 'editou',
      descricao: config.intervaloHoras
        ? `Backup automático a cada ${config.intervaloHoras}h, mantendo ${config.manter}`
        : 'Backup automático desativado',
    });
    res.json({ config, proximoAutomatico: backup.proximoAutomatico() });
  } catch (e) {
    falha(res, e);
  }
};
