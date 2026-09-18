/**
 * Envio de e-mails (usado na recuperação de senha).
 *
 * Funciona só quando o SMTP está configurado no .env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * e o pacote "nodemailer" está instalado (npm install).
 *
 * Sem essa configuração o sistema continua funcionando: o pedido de
 * redefinição aparece para o administrador na tela de Usuários.
 */

let transportador = null;

const smtpConfigurado = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const obterTransportador = () => {
  if (transportador) return transportador;
  if (!smtpConfigurado()) return null;

  let nodemailer;
  try {
    // eslint-disable-next-line global-require
    nodemailer = require('nodemailer');
  } catch {
    console.warn('⚠️  SMTP configurado, mas o pacote "nodemailer" não está instalado. Rode "npm install" no backend.');
    return null;
  }

  const porta = parseInt(process.env.SMTP_PORT || '587', 10);
  transportador = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transportador;
};

/** Envia um e-mail. Retorna true se enviou, false se não foi possível. */
const enviarEmail = async ({ para, assunto, texto, html }) => {
  const t = obterTransportador();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: para,
      subject: assunto,
      text: texto,
      html,
    });
    return true;
  } catch (e) {
    console.warn('⚠️  Falha ao enviar e-mail:', e.message);
    return false;
  }
};

module.exports = { enviarEmail, smtpConfigurado };
