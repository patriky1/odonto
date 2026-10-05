/**
 * Parcelamento no cartão de crédito.
 *
 * Só o cartão de crédito aceita parcelas: para qualquer outra forma de
 * pagamento o número volta a ser 1. O limite fica aqui para o backend e o
 * frontend (utils/recibo.js) usarem o mesmo valor.
 */

const MAX_PARCELAS_CARTAO = 12;

const aceitaParcelas = (forma) => forma === 'cartao_credito';

/** Número de parcelas válido (1..MAX) para a forma de pagamento informada. */
const normalizarParcelas = (forma, parcelas) => {
  if (!aceitaParcelas(forma)) return 1;
  const n = parseInt(parcelas, 10);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_PARCELAS_CARTAO);
};

/** Texto curto da forma para relatórios: "cartao_credito 10x". */
const formaComParcelas = (forma, parcelas) => {
  if (!forma) return '';
  return aceitaParcelas(forma) && parcelas > 1 ? `${forma} ${parcelas}x` : forma;
};

module.exports = { MAX_PARCELAS_CARTAO, aceitaParcelas, normalizarParcelas, formaComParcelas };
