import { formatCurrency } from '../../utils/formatters';

/** Valor do select para "procedimento que não está no cadastro". */
export const OUTRO = 'outro';

/**
 * Escolha do procedimento a partir do cadastro (tela Procedimentos),
 * com a opção "Outro" para digitar um nome livre.
 * `valor` = { procedimentoId: id | 'outro' | '', procedimento: texto livre }
 */
export default function SeletorProcedimento({ procedimentos, valor, onChange, tamanho }) {
  const estilo = tamanho === 'sm' ? { padding: '6px 10px', fontSize: 13 } : undefined;
  const selecionado = valor.procedimentoId ?? '';

  const trocar = (e) => {
    const v = e.target.value;
    onChange({ procedimentoId: v === '' || v === OUTRO ? v : Number(v), procedimento: v === OUTRO ? valor.procedimento : '' });
  };

  return (
    <>
      <select className="form-control" style={estilo} value={selecionado} onChange={trocar}>
        <option value="">Selecione o procedimento</option>
        {procedimentos.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}{p.valor > 0 ? ` — ${formatCurrency(p.valor)}` : ''}</option>
        ))}
        <option value={OUTRO}>Outro (digitar)</option>
      </select>
      {selecionado === OUTRO && (
        <input className="form-control" style={{ ...estilo, marginTop: tamanho === 'sm' ? 0 : 6 }} autoFocus
          placeholder="Nome do procedimento" value={valor.procedimento}
          onChange={(e) => onChange({ procedimentoId: OUTRO, procedimento: e.target.value })} />
      )}
    </>
  );
}
