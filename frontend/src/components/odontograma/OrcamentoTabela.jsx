import { useState } from 'react';
import { Save, Pencil, Trash2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { infoStatus } from './constantes';
import SeletorProcedimento, { OUTRO } from './SeletorProcedimento';

/** Valor do banco (número ou null) → texto do campo de preço ("150,50"). */
const precoParaCampo = (v) => (v === null || v === undefined ? '' : Number(v).toFixed(2).replace('.', ','));

/** Texto do campo → número (ou null quando vazio). */
const campoParaPreco = (texto) => {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export const rotuloAlvo = (item) => (item.numeroDente ? `Dente ${item.numeroDente}` : 'Boca inteira');

function LinhaOrcamento({ item, procedimentos, onSalvar, onExcluir, onAlternarRealizado }) {
  const [preco, setPreco] = useState(precoParaCampo(item.valor));
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const precoAlterado = campoParaPreco(preco) !== (item.valor ?? null);
  const alterado = precoAlterado || editando;

  const iniciarEdicao = () => {
    const doCadastro = procedimentos.some((p) => p.id === item.procedimentoId);
    setRascunho({
      procedimentoId: doCadastro ? item.procedimentoId : OUTRO,
      procedimento: doCadastro ? '' : item.procedimento,
      observacoes: item.observacoes || '',
    });
    setEditando(true);
  };

  const cancelar = () => {
    setEditando(false);
    setRascunho(null);
    setPreco(precoParaCampo(item.valor));
  };

  const salvar = async () => {
    const valor = campoParaPreco(preco);
    if (Number.isNaN(valor)) return;
    const dados = { valor };
    if (editando) {
      const outro = rascunho.procedimentoId === OUTRO;
      dados.procedimentoId = outro ? null : rascunho.procedimentoId;
      dados.procedimento = outro ? rascunho.procedimento.trim() : '';
      dados.observacoes = rascunho.observacoes;
      if (outro ? !dados.procedimento : !dados.procedimentoId) return;
    }
    setSalvando(true);
    try {
      await onSalvar(item, dados);
      setEditando(false);
      setRascunho(null);
    } catch { /* toast pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  const status = item.status ? infoStatus(item.status) : null;
  const precoInvalido = Number.isNaN(campoParaPreco(preco));

  return (
    <tr className={item.realizado ? 'orcamento-feito' : undefined}>
      <td className="td-titulo" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
        {rotuloAlvo(item)}
        {item.faces.length > 0 && <span className="text-xs text-muted" style={{ marginLeft: 6 }}>({item.faces.join(', ')})</span>}
      </td>
      <td data-label="Status">
        {status ? (
          <span className="badge" style={{ background: status.color, border: `1px solid ${status.border}`, color: '#1f2937' }}>{status.label}</span>
        ) : <span className="text-muted">—</span>}
      </td>
      <td data-label="Procedimento" style={{ minWidth: 180 }}>
        {editando ? (
          <div style={{ display: 'grid', gap: 6, width: '100%' }}>
            <SeletorProcedimento procedimentos={procedimentos} valor={rascunho} tamanho="sm"
              onChange={(v) => setRascunho((r) => ({ ...r, ...v }))} />
            <input className="form-control" style={{ padding: '6px 10px', fontSize: 13 }} placeholder="Observações"
              value={rascunho.observacoes} onChange={(e) => setRascunho((r) => ({ ...r, observacoes: e.target.value }))} />
          </div>
        ) : (
          <div>
            <span style={{ fontWeight: 500, textDecoration: item.realizado ? 'line-through' : 'none' }}>{item.procedimento}</span>
            {item.observacoes && <div className="text-xs text-muted">{item.observacoes}</div>}
          </div>
        )}
      </td>
      <td data-label="Valor (R$)" style={{ minWidth: 130 }}>
        <div>
          <input
            type="text" inputMode="decimal" className="form-control"
            style={{ padding: '6px 10px', fontSize: 13, maxWidth: 130, borderColor: precoInvalido ? 'var(--danger)' : undefined }}
            placeholder="0,00" value={preco}
            onChange={(e) => setPreco(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && alterado) salvar(); if (e.key === 'Escape') cancelar(); }}
            aria-label={`Preço de ${item.procedimento}`}
          />
          {item.valorTabela > 0 && campoParaPreco(preco) !== item.valorTabela && (
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 0', fontSize: 11, color: 'var(--primary)' }}
              onClick={() => setPreco(precoParaCampo(item.valorTabela))} title="Usar o valor cadastrado do procedimento">
              tabela: {formatCurrency(item.valorTabela)}
            </button>
          )}
        </div>
      </td>
      <td className="td-acoes">
        <div className="actions" style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm btn-icon" title="Salvar" onClick={salvar}
            disabled={!alterado || salvando || precoInvalido}
            style={{ color: alterado ? 'var(--primary)' : undefined }}><Save size={15} /></button>
          {editando ? (
            <button className="btn btn-ghost btn-sm btn-icon" title="Cancelar edição" onClick={cancelar}><X size={15} /></button>
          ) : (
            <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={iniciarEdicao}><Pencil size={15} /></button>
          )}
          <button className="btn btn-ghost btn-sm btn-icon" title="Excluir" style={{ color: 'var(--danger)' }}
            onClick={() => onExcluir(item)}><Trash2 size={15} /></button>
        </div>
      </td>
      <td data-label="Realizado" style={{ textAlign: 'center' }}>
        <label title={item.realizado ? 'Desmarcar como realizado' : 'Marcar como realizado'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={item.realizado} onChange={() => onAlternarRealizado(item)}
            style={{ width: 18, height: 18, accentColor: 'var(--success)', cursor: 'pointer' }} />
        </label>
      </td>
    </tr>
  );
}

/**
 * Lista do orçamento: uma linha por procedimento, com preço editável
 * na própria linha, salvar / editar / excluir, marcação de "realizado"
 * (a linha fica verde) e o total no rodapé.
 */
export default function OrcamentoTabela({ itens, procedimentos, onSalvar, onExcluir, onAlternarRealizado }) {
  const soma = (lista) => lista.reduce((t, i) => t + (Number(i.valor) || 0), 0);
  const total = soma(itens);
  const realizado = soma(itens.filter((i) => i.realizado));
  const semPreco = itens.filter((i) => i.valor === null || i.valor === undefined).length;

  if (itens.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '24px 12px' }}>
        <p className="text-sm text-muted">
          Nenhum procedimento no orçamento. Selecione um dente (ou “Boca inteira”), escolha o procedimento e salve.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="table table-cards">
          <thead>
            <tr><th>Dente</th><th>Status</th><th>Procedimento</th><th>Valor (R$)</th><th>Ações</th><th style={{ textAlign: 'center' }}>Feito</th></tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <LinhaOrcamento key={`${item.id}-${item.updatedAt}`} item={item} procedimentos={procedimentos}
                onSalvar={onSalvar} onExcluir={onExcluir} onAlternarRealizado={onAlternarRealizado} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="orcamento-totais">
        {semPreco > 0 && (
          <span className="text-xs" style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 'auto' }}>
            <AlertTriangle size={13} /> {semPreco} item(ns) sem preço
          </span>
        )}
        <div><span>Realizado</span><strong style={{ color: 'var(--success)' }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> {formatCurrency(realizado)}</strong></div>
        <div><span>A realizar</span><strong>{formatCurrency(total - realizado)}</strong></div>
        <div className="orcamento-total"><span>Total do orçamento</span><strong>{formatCurrency(total)}</strong></div>
      </div>
    </>
  );
}
