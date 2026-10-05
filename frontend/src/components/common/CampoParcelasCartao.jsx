import { formatCurrency } from '../../utils/formatters';
import {
  MAX_PARCELAS_CARTAO, aceitaParcelas, dividirParcelas, resumoParcelas,
} from '../../utils/recibo';

/**
 * Campo "Parcelas no cartão" — só aparece quando a forma de pagamento é
 * cartão de crédito. Cada opção já mostra o valor da parcela.
 *
 * Usado no lançamento de pagamento (Financeiro) e na emissão de recibo.
 */
export default function CampoParcelasCartao({ formaPagamento, valor, value, onChange }) {
  if (!aceitaParcelas(formaPagamento)) return null;

  const total = parseFloat(String(valor ?? '').replace(',', '.')) || 0;
  const atual = Math.max(1, parseInt(value, 10) || 1);
  const opcoes = Array.from({ length: MAX_PARCELAS_CARTAO }, (_, i) => i + 1);

  const rotulo = (n) => {
    if (n === 1) return total > 0 ? `À vista — ${formatCurrency(total)}` : 'À vista (1x)';
    // Valor "cheio" da parcela; a diferença de centavos aparece no resumo abaixo
    return total > 0 ? `${n}x de ${formatCurrency(dividirParcelas(total, n)[n - 1])}` : `${n}x`;
  };

  return (
    <div className="form-group">
      <label className="form-label">Parcelas no cartão</label>
      <select className="form-control" value={atual} onChange={onChange}>
        {opcoes.map((n) => <option key={n} value={n}>{rotulo(n)}</option>)}
      </select>
      {atual > 1 && total > 0 && (
        <p className="text-xs text-muted mt-1">
          {resumoParcelas(total, atual)} — total {formatCurrency(total)}
        </p>
      )}
    </div>
  );
}
