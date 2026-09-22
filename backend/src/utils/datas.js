/**
 * Datas no fuso horário da clínica.
 *
 * `new Date().toISOString()` devolve a data em UTC: no Brasil (UTC-3),
 * depois das 21h o "hoje" já vira o dia seguinte. Estas funções usam o
 * fuso configurado (padrão America/Sao_Paulo), inclusive quando o
 * servidor de hospedagem estiver em outro fuso.
 */

const FUSO = process.env.FUSO_HORARIO || 'America/Sao_Paulo';

/** Data de hoje no formato YYYY-MM-DD, no fuso da clínica. */
const hojeISO = (base = new Date()) => {
  try {
    // en-CA formata como YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(base);
  } catch {
    return base.toISOString().split('T')[0];
  }
};

/** Mês atual no formato YYYY-MM. */
const mesISO = () => hojeISO().substring(0, 7);

/** Soma (ou subtrai) dias a uma data YYYY-MM-DD. */
const somarDias = (dataISO, dias) => {
  const d = new Date(`${dataISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().split('T')[0];
};

/** Soma (ou subtrai) meses a um mês YYYY-MM. */
const somarMeses = (ym, meses) => {
  const [ano, mes] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

module.exports = { FUSO, hojeISO, mesISO, somarDias, somarMeses };
