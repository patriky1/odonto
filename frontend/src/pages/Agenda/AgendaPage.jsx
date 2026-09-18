import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, Calendar, UserCheck, AlertTriangle, DoorOpen, MessageCircle } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import AgendamentoForm from './AgendamentoForm';
import LembretesWhatsApp from './LembretesWhatsApp';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import { formatDate, getStatusAgendamento, dataISO, paraData } from '../../utils/formatters';
import toast from 'react-hot-toast';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PX_POR_HORA = 64;
const HORA_INICIO_PADRAO = 8;   // a grade sempre mostra pelo menos 08h–18h
const HORA_FIM_PADRAO = 18;
const DURACAO_SEM_FIM = 30;     // minutos, quando o agendamento não tem hora de término

const STATUS_COLORS_BG = {
  agendado: '#dbeafe', confirmado: '#ede9fe', em_atendimento: '#fef3c7',
  concluido: '#d1fae5', cancelado: '#fee2e2', nao_compareceu: '#f1f5f9',
};
const STATUS_COLORS_BORDER = {
  agendado: '#2563eb', confirmado: '#6366f1', em_atendimento: '#f59e0b',
  concluido: '#10b981', cancelado: '#ef4444', nao_compareceu: '#94a3b8',
};

const paraMinutos = (hora) => {
  const [h, m] = String(hora || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Início e fim (em minutos) de um agendamento. */
const intervalo = (ag) => {
  const ini = paraMinutos(ag.horaInicio);
  let fim = ag.horaFim ? paraMinutos(ag.horaFim) : ini + DURACAO_SEM_FIM;
  if (fim <= ini) fim = ini + DURACAO_SEM_FIM;
  return { ini, fim };
};

/**
 * Distribui os agendamentos de um dia em colunas, para que horários que se
 * sobrepõem (salas diferentes, por exemplo) apareçam lado a lado.
 */
const posicionarDia = (ags) => {
  const itens = ags
    .map((ag) => ({ ag, ...intervalo(ag) }))
    .sort((a, b) => a.ini - b.ini || b.fim - a.fim);

  const resultado = [];
  let grupo = [];
  let fimGrupo = -1;

  const fecharGrupo = () => {
    const colunasFim = [];
    grupo.forEach((it) => {
      let c = colunasFim.findIndex((f) => f <= it.ini);
      if (c === -1) { c = colunasFim.length; colunasFim.push(it.fim); } else colunasFim[c] = it.fim;
      it.coluna = c;
    });
    grupo.forEach((it) => resultado.push({ ...it, colunas: colunasFim.length }));
    grupo = [];
  };

  itens.forEach((it) => {
    if (grupo.length && it.ini >= fimGrupo) { fecharGrupo(); fimGrupo = -1; }
    grupo.push(it);
    fimGrupo = Math.max(fimGrupo, it.fim);
  });
  if (grupo.length) fecharGrupo();
  return resultado;
};

const visaoInicial = (param) => {
  if (param === 'dia' || param === 'semana') return param;
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'dia' : 'semana';
};

export default function AgendaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const confirmar = useConfirmacao();

  const [escopo, setEscopo] = useState(null);
  const [dentistaFiltro, setDentistaFiltro] = useState('');
  const [salaFiltro, setSalaFiltro] = useState('');
  const [dataAtual, setDataAtual] = useState(() => {
    const p = searchParams.get('data');
    return p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? paraData(p) : new Date();
  });
  const [view, setView] = useState(() => visaoInicial(searchParams.get('view')));
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [lembretesAberto, setLembretesAberto] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [dentistas, setDentistas] = useState([]);
  const [procedimentos, setProcedimentos] = useState([]);
  const [salas, setSalas] = useState([]);

  // Mantém a data e a visão no endereço (permite abrir a agenda já no dia certo)
  useEffect(() => {
    setSearchParams({ data: dataISO(dataAtual), view }, { replace: true });
  }, [dataAtual, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const dias = useMemo(() => {
    const d = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate());
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
  }, [dataAtual]);

  // Escopo: admin e recepção veem todos (com filtro opcional); dentista vê só a própria agenda
  useEffect(() => {
    api.get('/agendamentos/meu-escopo')
      .then(r => {
        setEscopo(r.data);
        if (r.data.dentistaId) setDentistaFiltro(String(r.data.dentistaId));
      })
      .catch(() => setEscopo({ veTodos: true, exigeSelecaoDentista: false }));
  }, []);

  const carregarAgendamentos = useCallback(() => {
    if (!escopo) return;
    setLoading(true);
    const params = view === 'dia'
      ? { data: dataISO(dataAtual) }
      : { dataInicio: dataISO(dias[0]), dataFim: dataISO(dias[6]) };
    // O backend ignora este parâmetro para o perfil dentista (segurança no servidor)
    if (dentistaFiltro) params.dentistaId = dentistaFiltro;
    if (salaFiltro) params.salaId = salaFiltro;

    api.get('/agendamentos', { params })
      .then(r => setAgendamentos(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dataAtual, view, dias, escopo, dentistaFiltro, salaFiltro]);

  useEffect(() => { carregarAgendamentos(); }, [carregarAgendamentos]);

  useEffect(() => {
    api.get('/pacientes', { params: { limite: 1000 } }).then(r => setPacientes(r.data.pacientes)).catch(() => {});
    api.get('/dentistas').then(r => setDentistas(r.data)).catch(() => {});
    api.get('/procedimentos').then(r => setProcedimentos(r.data)).catch(() => {});
    api.get('/salas').then(r => setSalas(r.data)).catch(() => {});
  }, []);

  const abrirNovo = () => { setEditando(null); setModalOpen(true); };
  const abrirEdicao = (ag) => { setEditando(ag); setModalOpen(true); };
  const fecharModal = () => { setModalOpen(false); setEditando(null); };

  const handleSalvar = async (data) => {
    try {
      if (editando) { await api.put(`/agendamentos/${editando.id}`, data); toast.success('Agendamento atualizado!'); }
      else { await api.post('/agendamentos', data); toast.success('Consulta agendada!'); }
      fecharModal(); carregarAgendamentos();
    } catch { /* mensagem já exibida pelo interceptor */ }
  };

  const handleStatus = async (id, status) => {
    try {
      await api.patch(`/agendamentos/${id}/status`, { status });
      toast.success('Status atualizado');
      carregarAgendamentos();
    } catch { /* noop */ }
  };

  const handleExcluir = async (ag) => {
    const ok = await confirmar({
      titulo: 'Excluir agendamento',
      item: `${ag.pacienteNome} — ${formatDate(ag.data)} às ${ag.horaInicio}`,
      mensagem: 'Se o paciente apenas desmarcou, prefira mudar o status para "Cancelado" e manter o histórico.',
    });
    if (!ok) return;
    try {
      await api.delete(`/agendamentos/${ag.id}`);
      toast.success('Agendamento excluído');
      fecharModal();
      carregarAgendamentos();
    } catch { /* noop */ }
  };

  const navegar = (dir) => {
    const d = new Date(dataAtual);
    d.setDate(d.getDate() + (view === 'dia' ? dir : dir * 7));
    setDataAtual(d);
  };

  const hojeStr = dataISO(new Date());
  const agsPorDia = useMemo(() => {
    const mapa = {};
    agendamentos.forEach((a) => { const k = String(a.data).split('T')[0]; (mapa[k] ||= []).push(a); });
    return mapa;
  }, [agendamentos]);

  // Faixa de horários da grade: 08h–18h, ampliada se houver algo fora disso
  const { horaIni, horaFim } = useMemo(() => {
    let ini = HORA_INICIO_PADRAO; let fim = HORA_FIM_PADRAO;
    agendamentos.forEach((a) => {
      const { ini: i, fim: f } = intervalo(a);
      ini = Math.min(ini, Math.floor(i / 60));
      fim = Math.max(fim, Math.ceil(f / 60));
    });
    return { horaIni: Math.max(0, ini), horaFim: Math.min(24, fim) };
  }, [agendamentos]);
  const alturaGrade = (horaFim - horaIni) * PX_POR_HORA;
  const topo = (min) => ((min - horaIni * 60) / 60) * PX_POR_HORA;
  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();

  const listaDia = useMemo(
    () => [...agendamentos].sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio)),
    [agendamentos]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Agenda</h1>
          <p>
            {escopo?.dentistaNome
              ? `Seus agendamentos — ${escopo.dentistaNome}`
              : 'Gerencie os agendamentos do consultório'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setLembretesAberto(true)} title="Lembrar pacientes das consultas de amanhã">
            <MessageCircle size={16} /> Lembretes WhatsApp
          </button>
          <button className="btn btn-primary" onClick={abrirNovo}><Plus size={16} /> Novo Agendamento</button>
        </div>
      </div>

      {escopo?.semVinculo && (
        <div className="card mb-4" style={{ borderLeft: '4px solid var(--warning)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Seu usuário ainda não está vinculado a um cadastro de dentista.</strong>
            <p className="text-sm text-muted">
              Peça ao administrador para abrir <em>Dentistas</em>, editar o seu cadastro e selecionar o seu usuário
              no campo "Usuário do sistema". Sem esse vínculo a agenda fica vazia.
            </p>
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-icon" onClick={() => navegar(-1)} title="Anterior"><ChevronLeft size={18} /></button>
            <h2 style={{ fontSize: 16, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>
              {view === 'dia'
                ? `${DIAS_SEMANA[dataAtual.getDay()]}, ${formatDate(dataAtual)}`
                : `${formatDate(dias[0])} — ${formatDate(dias[6])}`}
            </h2>
            <button className="btn btn-ghost btn-icon" onClick={() => navegar(1)} title="Próximo"><ChevronRight size={18} /></button>
            <button className="btn btn-secondary btn-sm" onClick={() => setDataAtual(new Date())}>Hoje</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {escopo && !escopo.dentistaId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserCheck size={15} color="var(--text-muted)" />
                <select className="form-control" style={{ maxWidth: 200, padding: '6px 10px', fontSize: 13 }}
                  value={dentistaFiltro} onChange={e => setDentistaFiltro(e.target.value)} aria-label="Filtrar por dentista">
                  <option value="">Todos os dentistas</option>
                  {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
            )}
            {salas.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DoorOpen size={15} color="var(--text-muted)" />
                <select className="form-control" style={{ maxWidth: 170, padding: '6px 10px', fontSize: 13 }}
                  value={salaFiltro} onChange={e => setSalaFiltro(e.target.value)} aria-label="Filtrar por sala">
                  <option value="">Todas as salas</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            )}
            {escopo?.dentistaNome && (
              <span className="badge badge-info"><UserCheck size={12} /> {escopo.dentistaNome}</span>
            )}
            {['dia', 'semana'].map(v => (
              <button key={v} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView(v)} style={{ textTransform: 'capitalize' }}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {view === 'semana' && (
            <div className="agenda-scroll">
              <div className="agenda-grade">
                {/* Cabeçalho dos dias — clique abre o dia */}
                <div className="agenda-cabecalho">
                  <div />
                  {dias.map((d) => {
                    const ehHoje = dataISO(d) === hojeStr;
                    return (
                      <button key={dataISO(d)} type="button" className="agenda-dia-cab"
                        onClick={() => { setDataAtual(d); setView('dia'); }}
                        title="Ver este dia"
                        style={{ background: ehHoje ? 'var(--primary-light)' : 'var(--bg)', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', font: 'inherit' }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{DIAS_SEMANA[d.getDay()]}</p>
                        <p style={{ fontSize: 20, fontWeight: 700, color: ehHoje ? 'var(--primary)' : 'var(--text)' }}>{d.getDate()}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Grade com os blocos posicionados pelo horário real */}
                <div className="agenda-corpo" style={{ height: alturaGrade }}>
                  <div className="agenda-horas">
                    {Array.from({ length: horaFim - horaIni }, (_, i) => (
                      <div key={i} className="agenda-hora" style={{ top: i * PX_POR_HORA }}>
                        {String(horaIni + i).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {dias.map((d) => {
                    const chave = dataISO(d);
                    const blocos = posicionarDia(agsPorDia[chave] || []);
                    return (
                      <div key={chave} className="agenda-coluna">
                        {Array.from({ length: horaFim - horaIni }, (_, i) => (
                          <div key={i}>
                            <div className="agenda-linha" style={{ top: i * PX_POR_HORA }} />
                            <div className="agenda-linha meia" style={{ top: i * PX_POR_HORA + PX_POR_HORA / 2 }} />
                          </div>
                        ))}
                        {chave === hojeStr && agoraMin >= horaIni * 60 && agoraMin <= horaFim * 60 && (
                          <div className="agenda-agora" style={{ top: topo(agoraMin) }} />
                        )}
                        {blocos.map(({ ag, ini, fim, coluna, colunas }) => {
                          const altura = Math.max(((fim - ini) / 60) * PX_POR_HORA - 2, 20);
                          const curto = altura < 40;
                          return (
                            <div
                              key={ag.id}
                              className="agenda-bloco"
                              onClick={() => abrirEdicao(ag)}
                              title={`${ag.horaInicio}${ag.horaFim ? `–${ag.horaFim}` : ''} · ${ag.pacienteNome} · ${ag.dentistaNome}${ag.salaNome ? ` · ${ag.salaNome}` : ''}`}
                              style={{
                                top: topo(ini) + 1,
                                height: altura,
                                left: `calc(${(coluna / colunas) * 100}% + 2px)`,
                                width: `calc(${100 / colunas}% - 4px)`,
                                background: STATUS_COLORS_BG[ag.status] || '#f1f5f9',
                                borderLeft: `3px solid ${STATUS_COLORS_BORDER[ag.status] || '#94a3b8'}`,
                                textDecoration: ag.status === 'cancelado' ? 'line-through' : 'none',
                              }}
                            >
                              <p className="truncate" style={{ fontWeight: 700 }}>
                                {curto && <span style={{ fontWeight: 600 }}>{ag.horaInicio} </span>}{ag.pacienteNome}
                              </p>
                              {!curto && (
                                <>
                                  <p className="truncate" style={{ color: 'var(--text-muted)' }}>
                                    {ag.horaInicio}{ag.horaFim ? `–${ag.horaFim}` : ''}
                                  </p>
                                  <p className="truncate" style={{ color: 'var(--text-muted)' }}>
                                    {ag.dentistaNome}{ag.salaNome ? ` · ${ag.salaNome}` : ''}
                                  </p>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'dia' && (
            <div>
              {listaDia.length === 0 ? (
                <div className="empty-state" style={{ padding: 60 }}>
                  <Calendar size={40} />
                  <h3>Nenhum agendamento para este dia</h3>
                  <button className="btn btn-primary btn-sm mt-2" onClick={abrirNovo}><Plus size={14} /> Agendar</button>
                </div>
              ) : (
                <div className="table-wrapper" style={{ padding: 8 }}>
                  <table className="table table-cards">
                    <thead><tr><th>Horário</th><th>Paciente</th><th>Dentista</th>{salas.length > 0 && <th>Sala</th>}<th>Procedimento</th><th>Status</th><th>Ações</th></tr></thead>
                    <tbody>
                      {listaDia.map(ag => (
                        <tr key={ag.id}>
                          <td data-label="Horário"><span><strong>{ag.horaInicio}</strong>{ag.horaFim && ` – ${ag.horaFim}`}</span></td>
                          <td data-label="Paciente" style={{ fontWeight: 600 }}>{ag.pacienteNome}</td>
                          <td data-label="Dentista">{ag.dentistaNome}</td>
                          {salas.length > 0 && <td data-label="Sala">{ag.salaNome || '—'}</td>}
                          <td data-label="Procedimento">{ag.procedimentoNome || '—'}</td>
                          <td data-label="Status">
                            <select className="form-control" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
                              value={ag.status} onChange={e => handleStatus(ag.id, e.target.value)} aria-label="Status">
                              <option value="agendado">Agendado</option>
                              <option value="confirmado">Confirmado</option>
                              <option value="em_atendimento">Em Atendimento</option>
                              <option value="concluido">Concluído</option>
                              <option value="cancelado">Cancelado</option>
                              <option value="nao_compareceu">Não Compareceu</option>
                            </select>
                          </td>
                          <td className="td-acoes">
                            <div className="actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => abrirEdicao(ag)}>Editar</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleExcluir(ag)}>Excluir</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legenda de cores */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {Object.keys(STATUS_COLORS_BG).map((st) => (
          <span key={st} className="text-xs text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLORS_BG[st], borderLeft: `3px solid ${STATUS_COLORS_BORDER[st]}` }} />
            {getStatusAgendamento(st).label}
          </span>
        ))}
      </div>

      <Modal open={modalOpen} onClose={fecharModal} title={editando ? 'Editar Agendamento' : 'Novo Agendamento'}
        footer={
          <>
            {editando && (
              <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => handleExcluir(editando)}>Excluir</button>
            )}
            <button className="btn btn-secondary" onClick={fecharModal}>Cancelar</button>
            <button className="btn btn-primary" form="form-agendamento" type="submit">Salvar</button>
          </>
        }>
        <AgendamentoForm
          key={editando?.id || `novo-${dataISO(dataAtual)}`}
          agendamento={editando}
          pacientes={pacientes}
          dentistas={dentistas}
          procedimentos={procedimentos}
          salas={salas}
          escopo={{ ...escopo, dentistaSugerido: dentistaFiltro, salaSugerida: salaFiltro, dataSugerida: view === 'dia' ? dataISO(dataAtual) : '' }}
          onSubmit={handleSalvar}
        />
      </Modal>

      <LembretesWhatsApp aberto={lembretesAberto} onFechar={() => { setLembretesAberto(false); carregarAgendamentos(); }} />
    </div>
  );
}
