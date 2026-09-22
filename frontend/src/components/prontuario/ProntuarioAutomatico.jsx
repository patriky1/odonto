import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Activity, Smile, Braces, NotebookPen, ClipboardList, FileSignature, UserX,
  Printer, Plus, AlertTriangle, RefreshCw, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../common/Modal';
import AnotacaoForm from './AnotacaoForm';
import { formatDate, getStatusAgendamento } from '../../utils/formatters';
import { imprimirHtml, montarHtmlProntuario } from '../../utils/impressao';

/** Aparência de cada tipo de registro na linha do tempo. */
const TIPOS = {
  atendimento: { label: 'Atendimentos', Icone: Calendar, cor: '#00959b' },
  tratamento: { label: 'Tratamentos', Icone: Activity, cor: '#7c3aed' },
  odontograma: { label: 'Odontograma', Icone: Smile, cor: '#0ea5e9' },
  ortodontia: { label: 'Ortodontia', Icone: Braces, cor: '#db2777' },
  anotacao: { label: 'Anotações', Icone: NotebookPen, cor: '#0f172a' },
  anamnese: { label: 'Anamnese', Icone: ClipboardList, cor: '#d97706' },
  termo: { label: 'Termos', Icone: FileSignature, cor: '#16a34a' },
  falta: { label: 'Faltas', Icone: UserX, cor: '#dc2626' },
};

const quandoTexto = (e) => {
  if (!e.quando) return '';
  const d = new Date(e.quando);
  if (Number.isNaN(d.getTime())) return '';
  const data = d.toLocaleDateString('pt-BR');
  if (e.soData) return data;
  return `${data} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Prontuário gerado automaticamente a partir dos atendimentos, tratamentos,
 * odontograma, ortodontia, anamnese e termos — mais as anotações manuais.
 */
export default function ProntuarioAutomatico({ pacienteId }) {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState([]); // tipos visíveis; vazio = todos
  const [dentistas, setDentistas] = useState([]);
  const [empresa, setEmpresa] = useState({});
  const [anotacao, setAnotacao] = useState(null); // {} = nova | { id, ... } = edição

  const carregar = useCallback(() => {
    setLoading(true);
    api.get(`/prontuarios/paciente/${pacienteId}`)
      .then((r) => setDados(r.data))
      .catch(() => setDados(null))
      .finally(() => setLoading(false));
  }, [pacienteId]);

  useEffect(() => {
    carregar();
    api.get('/dentistas').then((r) => setDentistas(r.data)).catch(() => {});
    api.get('/configuracoes/clinica').then((r) => setEmpresa(r.data || {})).catch(() => {});
  }, [carregar]);

  const contagem = useMemo(() => {
    const c = {};
    (dados?.eventos || []).forEach((e) => { c[e.tipo] = (c[e.tipo] || 0) + 1; });
    return c;
  }, [dados]);

  const eventos = useMemo(
    () => (dados?.eventos || []).filter((e) => filtro.length === 0 || filtro.includes(e.tipo)),
    [dados, filtro]
  );

  const alternarFiltro = (tipo) => setFiltro((f) => (f.includes(tipo) ? f.filter((t) => t !== tipo) : [...f, tipo]));

  const abrirEdicao = async (evento) => {
    try {
      const { data } = await api.get(`/prontuarios/${evento.referenciaId}`);
      setAnotacao(data);
    } catch { /* noop */ }
  };

  const salvarAnotacao = async (form) => {
    try {
      if (anotacao?.id) await api.put(`/prontuarios/${anotacao.id}`, form);
      else await api.post('/prontuarios', { ...form, pacienteId });
      toast.success(anotacao?.id ? 'Anotação atualizada' : 'Anotação adicionada ao prontuário');
      setAnotacao(null);
      carregar();
    } catch { /* noop */ }
  };

  const imprimir = () => imprimirHtml(montarHtmlProntuario(dados, { empresa, tipos: filtro.length ? filtro : null }));

  if (loading && !dados) return <div className="loading"><div className="spinner" /></div>;
  if (!dados) return <div className="empty-state"><h3>Não foi possível montar o prontuário</h3></div>;

  const { resumo, alertas, odontograma, tratamentos, ficha } = dados;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <p className="text-sm text-muted" style={{ maxWidth: 620 }}>
          Montado automaticamente com os atendimentos, tratamentos, odontograma, ortodontia, anamnese e termos do paciente.
          Use as anotações para registrar diagnóstico, prescrição e evolução.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={carregar} title="Atualizar"><RefreshCw size={14} className={loading ? 'girando' : ''} /></button>
          <button className="btn btn-secondary btn-sm" onClick={imprimir}><Printer size={14} /> Imprimir</button>
          <button className="btn btn-primary btn-sm" onClick={() => setAnotacao({})}><Plus size={14} /> Nova anotação</button>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning)', background: '#fffbeb' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: '#92400e', fontSize: 14 }}>Alertas clínicos</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: '#92400e', fontSize: 13 }}>
                {alertas.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="pront-resumo">
          <div className="pront-resumo-item"><strong>{resumo.totalAtendimentos}</strong><span>atendimentos realizados</span></div>
          <div className="pront-resumo-item">
            <strong>{resumo.ultimoAtendimento ? formatDate(resumo.ultimoAtendimento) : '—'}</strong>
            <span>último atendimento</span>
          </div>
          <div className="pront-resumo-item">
            <strong>{resumo.tratamentos.ativos}</strong>
            <span>tratamento(s) em aberto de {resumo.tratamentos.total}</span>
          </div>
          <div className="pront-resumo-item"><strong>{resumo.faltas}</strong><span>falta(s)</span></div>
          <div className="pront-resumo-item">
            <strong>{resumo.termosAssinados}</strong>
            <span>termo(s) assinado(s){resumo.termosPendentes ? `, ${resumo.termosPendentes} pendente(s)` : ''}</span>
          </div>
        </div>
        {(resumo.dentistas.length > 0 || resumo.proximosAgendamentos.length > 0 || ficha?.queixaPrincipal) && (
          <div style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 13 }}>
            {ficha?.queixaPrincipal && <p><strong>Queixa principal:</strong> {ficha.queixaPrincipal}</p>}
            {resumo.dentistas.length > 0 && <p><strong>Profissionais:</strong> {resumo.dentistas.join(', ')}</p>}
            {resumo.proximosAgendamentos.length > 0 && (
              <p>
                <strong>Próximos agendamentos:</strong>{' '}
                {resumo.proximosAgendamentos.map((a) => {
                  const st = getStatusAgendamento(a.status);
                  return (
                    <span key={a.id} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>
                      {formatDate(a.data)} {a.horaInicio} ({a.procedimentoNome || 'Consulta'}) <span className={`badge ${st.className}`}>{st.label}</span>
                    </span>
                  );
                })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Odontograma atual</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/odontograma?paciente=${pacienteId}`)}>Abrir</button>
          </div>
          {odontograma.totalMarcacoes === 0 ? (
            <p className="text-sm text-muted">Nenhuma marcação no odontograma.</p>
          ) : (
            <>
              <ul style={{ paddingLeft: 18, fontSize: 13, marginBottom: 12 }}>
                {odontograma.resumo.map((r) => (
                  <li key={r.status}><strong>{r.rotulo}:</strong> {r.dentes.join(', ')}</li>
                ))}
              </ul>
              <div className="pront-dentes">
                {odontograma.dentes.map((d) => (
                  <div key={d.numeroDente} className="pront-dente">
                    <strong>{d.numeroDente}</strong>
                    {d.marcacoes.map((m, i) => (
                      <div key={i} className="text-xs">
                        {m.faceRotulo ? `${m.faceRotulo}: ` : ''}{m.statusRotulo || '—'}
                        {m.procedimento ? <span className="text-muted"> ({m.procedimento})</span> : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Plano de tratamento</h3></div>
          {tratamentos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum tratamento registrado.</p>
          ) : tratamentos.map((t) => {
            const pct = t.sessoes > 0 ? Math.round((t.sessoesRealizadas / t.sessoes) * 100) : 0;
            return (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 13.5 }}>{t.nome}</strong>
                  <span className={`badge ${t.status === 'concluido' ? 'badge-success' : t.status === 'em_andamento' ? 'badge-warning' : t.status === 'cancelado' ? 'badge-danger' : 'badge-gray'}`}>
                    {t.statusRotulo}
                  </span>
                </div>
                <p className="text-xs text-muted">{t.sessoesRealizadas}/{t.sessoes} sessões{t.dentistaNome ? ` — ${t.dentistaNome}` : ''}</p>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Evolução clínica</h3></div>
        <div className="pront-filtros" role="group" aria-label="Filtrar registros">
          <button type="button" className="pront-filtro" aria-pressed={filtro.length === 0} onClick={() => setFiltro([])}>
            Tudo ({dados.eventos.length})
          </button>
          {Object.entries(TIPOS).filter(([tipo]) => contagem[tipo]).map(([tipo, { label, Icone }]) => (
            <button key={tipo} type="button" className="pront-filtro" aria-pressed={filtro.includes(tipo)} onClick={() => alternarFiltro(tipo)}>
              <Icone size={13} /> {label} ({contagem[tipo]})
            </button>
          ))}
        </div>

        {eventos.length === 0 ? (
          <div className="empty-state">
            <NotebookPen size={40} />
            <h3>Nada registrado ainda</h3>
            <p className="text-sm text-muted">
              Os atendimentos concluídos na agenda, os tratamentos e as alterações no odontograma aparecem aqui automaticamente.
            </p>
          </div>
        ) : (
          <ol className="pront-linha">
            {eventos.map((e) => {
              const t = TIPOS[e.tipo] || TIPOS.anotacao;
              return (
                <li key={e.id} className="pront-evento">
                  <span className="pront-marcador" style={{ color: t.cor }}><t.Icone size={10} /></span>
                  <div className="pront-evento-topo">
                    <span className="pront-evento-titulo">{e.titulo}</span>
                    <span className="pront-evento-quando">{quandoTexto(e)}</span>
                  </div>
                  {e.subtitulo && <div className="pront-evento-sub">{e.subtitulo}</div>}
                  {(e.dentista || e.responsavel) && (
                    <div className="pront-evento-sub">
                      {e.dentista && <>Profissional: {e.dentista}</>}
                      {e.dentista && e.responsavel && ' — '}
                      {e.responsavel && <>registrado por {e.responsavel}</>}
                    </div>
                  )}
                  {(e.campos?.length > 0 || e.detalhes?.length > 0) && (
                    <div className="pront-evento-corpo">
                      {e.campos?.map((c) => (
                        <div key={c.rotulo} className="pront-campo">
                          <div className="pront-campo-rotulo">{c.rotulo}</div>
                          <p>{c.texto}</p>
                        </div>
                      ))}
                      {e.detalhes?.length > 0 && (
                        e.detalhes.length === 1 && !e.campos?.length
                          ? <p>{e.detalhes[0]}</p>
                          : <ul>{e.detalhes.map((d, i) => <li key={i}>{d}</li>)}</ul>
                      )}
                    </div>
                  )}
                  {e.editavel && (
                    <button className="btn btn-ghost btn-sm mt-1" onClick={() => abrirEdicao(e)}><Pencil size={13} /> Editar anotação</button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <Modal open={Boolean(anotacao)} onClose={() => setAnotacao(null)} size="lg"
        title={anotacao?.id ? 'Editar anotação clínica' : 'Nova anotação clínica'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setAnotacao(null)}>Cancelar</button>
          <button className="btn btn-primary" form="form-anotacao" type="submit">Salvar anotação</button>
        </>}>
        {anotacao && (
          <AnotacaoForm key={anotacao.id || 'nova'} anotacao={anotacao.id ? anotacao : null} dentistas={dentistas} onSubmit={salvarAnotacao} />
        )}
      </Modal>
    </div>
  );
}
