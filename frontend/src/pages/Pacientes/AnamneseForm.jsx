import { useState, useEffect } from 'react';
import { ClipboardList, Save, AlertTriangle, Check } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../utils/formatters';

/**
 * Anamnese odontológica do paciente.
 * O questionário vem do backend (fonte única da verdade) e as respostas
 * ficam gravadas em JSON, vinculadas ao paciente.
 */
export default function AnamneseForm({ pacienteId, onSalvo }) {
  const [questionario, setQuestionario] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [observacoes, setObservacoes] = useState('');
  const [meta, setMeta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([
      api.get('/anamnese/questionario'),
      api.get(`/anamnese/paciente/${pacienteId}`),
    ])
      .then(([q, a]) => {
        if (!ativo) return;
        setQuestionario(q.data);
        setRespostas(a.data.respostas || {});
        setObservacoes(a.data.observacoes || '');
        setMeta(a.data);
        setAlterado(false);
      })
      .catch(() => {})
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [pacienteId]);

  const responder = (id, campo, valor) => {
    setRespostas((r) => ({ ...r, [id]: { ...(r[id] || {}), [campo]: valor } }));
    setAlterado(true);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.put(`/anamnese/paciente/${pacienteId}`, { respostas, observacoes });
      setMeta(data);
      setAlterado(false);
      toast.success('Anamnese salva');
      onSalvo?.(data);
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  const alertasAtivos = (meta?.alertas || []).length;
  const respondidas = Object.values(respostas).filter((r) => r?.valor).length;
  const totalPerguntas = questionario.reduce((s, sec) => s + sec.perguntas.length, 0);

  if (carregando) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      {/* Resumo */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <span className="badge badge-info">
          {respondidas} de {totalPerguntas} respondidas
        </span>
        {meta?.updatedAt && (
          <span className="text-xs text-muted">
            Atualizada em {formatDateTime(meta.updatedAt)}
            {meta.preenchidoPor ? ` por ${meta.preenchidoPor}` : ''}
          </span>
        )}
        {alterado && <span className="badge badge-warning">Alterações não salvas</span>}
      </div>

      {/* Alertas clínicos */}
      {alertasAtivos > 0 && (
        <div style={{ background: '#fef3c7', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <AlertTriangle size={18} color="#b45309" />
            <strong style={{ color: '#92400e', fontSize: 14 }}>
              {alertasAtivos} alerta(s) clínico(s) — atenção antes do atendimento
            </strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 26, color: '#92400e', fontSize: 13 }}>
            {meta.alertas.map((a) => (
              <li key={a.id}>{a.pergunta}{a.detalhe ? ` — ${a.detalhe}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Seções do questionário */}
      {questionario.map((secao) => (
        <div key={secao.secao} style={{ marginBottom: 22 }}>
          <h4 style={{
            fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4,
            color: 'var(--text-muted)', paddingBottom: 6, borderBottom: '1px solid var(--border)', marginBottom: 12,
          }}>
            {secao.secao}
          </h4>

          {secao.perguntas.map((p) => {
            const atual = respostas[p.id] || {};
            const marcadoSim = atual.valor === 'sim';

            return (
              <div key={p.id} style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.texto}
                  {p.alerta && marcadoSim && <AlertTriangle size={13} color="var(--warning)" />}
                </label>

                {p.tipo === 'sim_nao' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['sim', 'Sim'], ['nao', 'Não'], ['', 'Não informado']].map(([v, rotulo]) => (
                      <button
                        key={v || 'vazio'}
                        type="button"
                        className={`btn btn-sm ${atual.valor === v || (!atual.valor && v === '') ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => responder(p.id, 'valor', v)}
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                )}

                {p.tipo === 'opcoes' && (
                  <select className="form-control" value={atual.valor || ''} onChange={(e) => responder(p.id, 'valor', e.target.value)}>
                    <option value="">Não informado</option>
                    {p.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}

                {p.tipo === 'texto' && (
                  <input className="form-control" value={atual.valor || ''} onChange={(e) => responder(p.id, 'valor', e.target.value)} />
                )}

                {p.tipo === 'textarea' && (
                  <textarea className="form-control" style={{ minHeight: 70 }} value={atual.valor || ''}
                    onChange={(e) => responder(p.id, 'valor', e.target.value)} />
                )}

                {/* Campo de detalhe aparece quando a resposta é "Sim" */}
                {p.detalhe && marcadoSim && (
                  <input
                    className="form-control"
                    style={{ marginTop: 6 }}
                    placeholder={p.detalhe}
                    value={atual.detalhe || ''}
                    onChange={(e) => responder(p.id, 'detalhe', e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="form-group">
        <label className="form-label">Observações gerais do profissional</label>
        <textarea className="form-control" style={{ minHeight: 80 }} value={observacoes}
          onChange={(e) => { setObservacoes(e.target.value); setAlterado(true); }}
          placeholder="Anotações adicionais sobre o histórico do paciente..." />
      </div>

      {/* Fica fixa no rodapé da tela enquanto rola o questionário (importante no celular) */}
      <div className="barra-salvar">
        <button className="btn btn-primary" onClick={salvar} disabled={salvando}
          style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}>
          {salvando ? <><ClipboardList size={15} /> Salvando...</> : <><Save size={15} /> Salvar anamnese</>}
        </button>
        {alterado ? (
          <p className="text-xs mt-1" style={{ textAlign: 'center', color: 'var(--warning)' }}>Há alterações não salvas</p>
        ) : meta?.preenchida && (
          <p className="text-xs text-muted mt-1" style={{ textAlign: 'center' }}>
            <Check size={12} style={{ verticalAlign: -2 }} /> Tudo salvo
          </p>
        )}
      </div>
    </div>
  );
}
