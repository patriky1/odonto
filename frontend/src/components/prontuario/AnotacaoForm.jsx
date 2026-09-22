import { useState } from 'react';
import { dataISO } from '../../utils/formatters';

export const CAMPOS_ANOTACAO = [
  { k: 'queixaPrincipal', label: 'Queixa principal' },
  { k: 'historico', label: 'Histórico' },
  { k: 'diagnostico', label: 'Diagnóstico' },
  { k: 'procedimentos', label: 'Procedimentos realizados' },
  { k: 'evolucao', label: 'Evolução' },
  { k: 'medicamentos', label: 'Medicamentos prescritos' },
  { k: 'observacoes', label: 'Observações clínicas' },
  { k: 'anotacoes', label: 'Anotações do dentista' },
];

/** Converte a data guardada para o campo datetime-local (hora local). */
const paraCampo = (valor) => {
  if (!valor) return '';
  const v = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T12:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(v)) {
    // gravado pelo banco em UTC
    const d = new Date(`${v.replace(' ', 'T')}Z`);
    return `${dataISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return v.slice(0, 16);
};

const agora = () => {
  const d = new Date();
  return `${dataISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Anotação clínica manual. Complementa o prontuário automático com o que
 * o sistema não registra sozinho (diagnóstico, prescrição, evolução...).
 * Todos os campos são opcionais, mas ao menos um precisa ser preenchido.
 */
export default function AnotacaoForm({ anotacao, dentistas, dentistaPadrao = '', onSubmit }) {
  const [form, setForm] = useState(() => ({
    dentistaId: anotacao?.dentistaId || dentistaPadrao || '',
    data: paraCampo(anotacao?.data) || agora(),
    ...Object.fromEntries(CAMPOS_ANOTACAO.map(({ k }) => [k, anotacao?.[k] || ''])),
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const vazio = CAMPOS_ANOTACAO.every(({ k }) => !String(form[k]).trim());

  return (
    <form id="form-anotacao" onSubmit={(e) => { e.preventDefault(); if (!vazio) onSubmit(form); }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="an-dentista">Profissional</label>
          <select id="an-dentista" className="form-control" value={form.dentistaId} onChange={set('dentistaId')}>
            <option value="">Selecione</option>
            {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="an-data">Data e hora</label>
          <input id="an-data" type="datetime-local" className="form-control" value={form.data} onChange={set('data')} />
        </div>
      </div>
      {CAMPOS_ANOTACAO.map(({ k, label }) => (
        <div className="form-group" key={k}>
          <label className="form-label" htmlFor={`an-${k}`}>{label}</label>
          <textarea id={`an-${k}`} className="form-control" value={form[k]} onChange={set(k)} style={{ minHeight: 56 }} />
        </div>
      ))}
      {vazio && <p className="text-xs text-muted">Preencha ao menos um campo para salvar.</p>}
    </form>
  );
}
