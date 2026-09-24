import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, DollarSign, Activity, Smile, Pencil, MessageCircle, UserCheck,
  ClipboardList, Braces, ExternalLink, AlertTriangle, Link2, Save, X, Building2, Camera, Receipt, FileSignature, NotebookPen } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import FotoPacienteModal, { AvatarPaciente } from '../../components/common/FotoPaciente';
import AnamneseForm from './AnamneseForm';
import OrtodontiaPanel from './OrtodontiaPanel';
import ReciboModal from '../../components/common/ReciboModal';
import TermosPanel from './TermosPanel';
import RegistradoPor from '../../components/common/RegistradoPor';
import ProntuarioAutomatico from '../../components/prontuario/ProntuarioAutomatico';
import Modal from '../../components/common/Modal';
import PacienteForm from './PacienteForm';
import OrcamentoPanel from './OrcamentoPanel';
import TratamentosPanel from './TratamentosPanel';
import { formatDate, formatCPF, calcularIdade, formatCurrency, getStatusAgendamento, getStatusPagamento } from '../../utils/formatters';

/**
 * Link do paciente no CFaz (antigo "iDoc", coluna linkIdoc).
 * Fica sempre visível no perfil: com link, abre a página; sem link,
 * pede para inserir ali mesmo.
 */
function CampoCFaz({ paciente, onSalvo }) {
  const link = paciente.linkIdoc || '';
  const [editando, setEditando] = useState(!link);
  const [valor, setValor] = useState(link);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setValor(link); setEditando(!link); }, [link]);

  const salvar = async (e) => {
    e.preventDefault();
    let url = valor.trim();
    if (!url) return toast.error('Cole o link do paciente no CFaz');
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setSalvando(true);
    try {
      await api.put(`/pacientes/${paciente.id}`, { linkIdoc: url });
      toast.success('Link do CFaz salvo');
      onSalvo();
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  if (!editando) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
          <ExternalLink size={14} /> Abrir no CFaz
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(true)} title="Trocar o link do CFaz">
          <Pencil size={13} /> Trocar link
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} style={{
      marginTop: 10, padding: '10px 12px', borderRadius: 8,
      border: `1px dashed ${link ? 'var(--border)' : 'var(--warning)'}`, background: link ? 'var(--bg)' : '#fffbeb',
    }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Link2 size={14} /> CFaz
        {!link && <span className="text-xs" style={{ color: '#b45309', fontWeight: 500 }}>— nenhum link cadastrado, insira o link do paciente</span>}
      </label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input type="text" inputMode="url" className="form-control" style={{ flex: '1 1 220px', padding: '6px 10px', fontSize: 13 }}
          placeholder="https://... (link do paciente no CFaz)" value={valor} onChange={(e) => setValor(e.target.value)}
          autoFocus={Boolean(link)} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
          <Save size={13} /> {salvando ? 'Salvando...' : 'Salvar link'}
        </button>
        {link && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setValor(link); setEditando(false); }}>
            <X size={13} /> Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const ABA_PADRAO = 'orcamento';
const ABAS = ['orcamento', 'prontuario', 'termos', 'anamnese', 'ortodontia', 'agenda', 'tratamentos', 'financeiro'];

export default function PacienteDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paciente, setPaciente] = useState(null);
  // A aba fica na URL (?aba=termos) para poder compartilhar/voltar direto nela
  const abaUrl = searchParams.get('aba');
  const aba = ABAS.includes(abaUrl) ? abaUrl : ABA_PADRAO;
  const setAba = (nova) => setSearchParams(nova === ABA_PADRAO ? {} : { aba: nova }, { replace: true });
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [termosPendentes, setTermosPendentes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alertasAnamnese, setAlertasAnamnese] = useState([]);
  const [fotoAberta, setFotoAberta] = useState(false);
  const [dentistas, setDentistas] = useState([]);
  const [reciboModal, setReciboModal] = useState(null); // { pagamento } | {}

  const salvarFoto = async (foto) => {
    const { data } = await api.put(`/pacientes/${id}/foto`, { foto });
    setPaciente((p) => ({ ...p, foto: data.foto }));
    toast.success(foto ? 'Foto atualizada' : 'Foto removida');
  };

  const carregarPaciente = () => api.get(`/pacientes/${id}`).then(r => setPaciente(r.data)).catch(() => {});

  const salvarPerfil = async (dados) => {
    try {
      await api.put(`/pacientes/${id}`, dados);
      toast.success('Perfil atualizado');
      setEditandoPerfil(false);
      carregarPaciente();
    } catch { /* mensagem já exibida pelo interceptor */ }
  };

  useEffect(() => {
    carregarPaciente().finally(() => setLoading(false));
    // Alertas clínicos aparecem no topo da ficha, em qualquer aba
    api.get(`/anamnese/paciente/${id}`).then(r => setAlertasAnamnese(r.data.alertas || [])).catch(() => {});
    api.get('/dentistas').then(r => setDentistas(r.data)).catch(() => {});
    api.get(`/termos/paciente/${id}`).then(r => setTermosPendentes(r.data.filter(t => t.status === 'pendente').length)).catch(() => {});
  }, [id]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!paciente) return <div className="empty-state"><h3>Paciente não encontrado</h3></div>;

  const aba_items = [
    { id: 'anamnese', label: 'Anamnese', icon: ClipboardList },
    { id: 'orcamento', label: 'Orçamento', icon: Smile },
    { id: 'ortodontia', label: 'Ortodontia', icon: Braces },
    { id: 'prontuario', label: 'Prontuário', icon: NotebookPen },
    { id: 'termos', label: termosPendentes ? `Termos (${termosPendentes} pendente${termosPendentes > 1 ? 's' : ''})` : 'Termos', icon: FileSignature },
    { id: 'agenda', label: 'Histórico', icon: Calendar },
    { id: 'tratamentos', label: 'Tratamentos', icon: Activity },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  ];

  return (
    <div>
      <div className="perfil-topo">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/pacientes')} title="Voltar para a lista"><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, wordBreak: 'break-word' }}>{paciente.nome}</h1>
          <p className="text-muted text-sm">Paciente desde {formatDate(paciente.createdAt)}</p>
        </div>
        <div className="perfil-topo-acoes">
          <button className="btn btn-secondary" onClick={() => setEditandoPerfil(true)}>
            <Pencil size={16} /> Editar perfil
          </button>
          <button className="btn btn-secondary" onClick={() => setReciboModal({})}>
            <Receipt size={16} /> Emitir recibo
          </button>
        </div>
      </div>

      {/* Alertas clínicos vindos da anamnese */}
      {alertasAnamnese.length > 0 && (
        <div className="card mb-4" style={{ borderLeft: '4px solid var(--warning)', background: '#fffbeb' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: '#92400e', fontSize: 14 }}>Alertas clínicos da anamnese</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#92400e', fontSize: 13 }}>
                {alertasAnamnese.map(a => (
                  <li key={a.id}>{a.pergunta}{a.detalhe ? ` — ${a.detalhe}` : ''}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Perfil */}
      <div className="card mb-4 perfil-card">
        <div className="foto-paciente" style={{ width: 88, height: 88 }}>
          <button type="button" onClick={() => setFotoAberta(true)} title={paciente.foto ? 'Trocar foto' : 'Adicionar foto'}
            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%', display: 'block' }}>
            <AvatarPaciente paciente={paciente} tamanho={88} fonte={28} />
          </button>
          <button type="button" className="foto-paciente-botao" onClick={() => setFotoAberta(true)} title={paciente.foto ? 'Trocar foto' : 'Adicionar foto'}>
            <Camera size={15} />
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>{paciente.nome}</h2>
          <div className="perfil-dados" style={{ display: 'flex', gap: '8px 24px', flexWrap: 'wrap', marginTop: 8 }}>
            {paciente.cpf && <span className="text-sm text-muted"><strong>CPF:</strong> {formatCPF(paciente.cpf)}</span>}
            {paciente.dataNascimento && <span className="text-sm text-muted"><strong>Idade:</strong> {calcularIdade(paciente.dataNascimento)} anos</span>}
            {paciente.sexo && <span className="text-sm text-muted"><strong>Sexo:</strong> {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Feminino' : 'Outro'}</span>}
            {paciente.telefone && <span className="text-sm text-muted"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />{paciente.telefone}</span>}
            {paciente.whatsapp && paciente.whatsapp !== paciente.telefone && (
              <span className="text-sm text-muted"><MessageCircle size={12} style={{ display: 'inline', marginRight: 4 }} />{paciente.whatsapp}</span>
            )}
            {paciente.email && <span className="text-sm text-muted"><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />{paciente.email}</span>}
            {(paciente.endereco || paciente.cidade || paciente.cep) && (
              <span className="text-sm text-muted">
                <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                {[paciente.endereco, paciente.cidade && `${paciente.cidade}${paciente.estado ? `/${paciente.estado}` : ''}`, paciente.cep && `CEP ${paciente.cep}`].filter(Boolean).join(' — ')}
              </span>
            )}
            {paciente.responsavel && (
              <span className="text-sm text-muted"><UserCheck size={12} style={{ display: 'inline', marginRight: 4 }} /><strong>Responsável:</strong> {paciente.responsavel}</span>
            )}
            {paciente.cidadeAtendimento && (
              <span className="badge badge-info"><Building2 size={12} /> Atendido em {paciente.cidadeAtendimento}</span>
            )}
          </div>
          {paciente.observacoes && (
            <p className="text-sm" style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
              <strong>Observações:</strong> {paciente.observacoes}
            </p>
          )}
          <CampoCFaz paciente={paciente} onSalvo={carregarPaciente} />
        </div>
      </div>

      <div className="tabs">
        {aba_items.map(({ id: aId, label, icon: Icon }) => (
          <button key={aId} className={`tab ${aba === aId ? 'active' : ''}`} onClick={() => setAba(aId)}>
            <Icon size={14} style={{ display: 'inline', marginRight: 6 }} />{label}
          </button>
        ))}
      </div>

      {aba === 'orcamento' && <OrcamentoPanel pacienteId={id} />}

      {aba === 'prontuario' && <ProntuarioAutomatico pacienteId={id} />}

      {aba === 'termos' && (
        <div className="card">
          <h3 className="card-title mb-4">Termos de autorização e consentimento</h3>
          <TermosPanel paciente={paciente} dentistas={dentistas}
            onAlterado={(lista) => setTermosPendentes(lista.filter(t => t.status === 'pendente').length)} />
        </div>
      )}

      {aba === 'anamnese' && (
        <div className="card">
          <h3 className="card-title mb-4">Anamnese Odontológica</h3>
          <AnamneseForm pacienteId={id} onSalvo={(d) => setAlertasAnamnese(d.alertas || [])} />
        </div>
      )}

      {aba === 'ortodontia' && (
        <div className="card">
          <h3 className="card-title mb-4">Procedimentos Ortodônticos</h3>
          <OrtodontiaPanel pacienteId={id} />
        </div>
      )}

      {aba === 'agenda' && (
        <div className="card">
          <h3 className="card-title mb-4">Histórico de Consultas</h3>
          <div className="table-wrapper">
            <table className="table table-cards">
              <thead><tr><th>Data</th><th>Hora</th><th>Dentista</th><th>Procedimento</th><th>Status</th></tr></thead>
              <tbody>
                {(paciente.agendamentos || []).map(ag => {
                  const st = getStatusAgendamento(ag.status);
                  return (
                    <tr key={ag.id}>
                      <td data-label="Data">{formatDate(ag.data)}<RegistradoPor registro={ag} /></td>
                      <td data-label="Hora">{ag.horaInicio}</td>
                      <td data-label="Dentista">{ag.dentistaNome}</td>
                      <td data-label="Procedimento">{ag.procedimentoNome || 'Consulta'}</td>
                      <td data-label="Status"><span className={`badge ${st.className}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
                {(paciente.agendamentos || []).length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>Nenhuma consulta registrada</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'tratamentos' && <TratamentosPanel pacienteId={id} />}

      {aba === 'financeiro' && (
        <div className="card">
          <h3 className="card-title mb-4">Histórico Financeiro</h3>
          <div className="table-wrapper">
            <table className="table table-cards">
              <thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Pagamento</th><th>Status</th><th>Recibo</th></tr></thead>
              <tbody>
                {(paciente.pagamentos || []).map(pg => {
                  const st = getStatusPagamento(pg.status);
                  return (
                    <tr key={pg.id}>
                      <td className="td-titulo">{pg.descricao}<RegistradoPor registro={pg} /></td>
                      <td data-label="Valor">{formatCurrency(pg.valor)}</td>
                      <td data-label="Vencimento">{formatDate(pg.dataVencimento)}</td>
                      <td data-label="Pagamento">{formatDate(pg.dataPagamento)}</td>
                      <td data-label="Status"><span className={`badge ${st.className}`}>{st.label}</span></td>
                      <td className="td-acoes">
                        <button className="btn btn-ghost btn-sm" title="Emitir recibo deste pagamento"
                          onClick={() => setReciboModal({ pagamento: pg })}><Receipt size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
                {(paciente.pagamentos || []).length === 0 && <tr><td colSpan={6}><div className="empty-state"><p>Nenhum pagamento registrado</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={editandoPerfil} onClose={() => setEditandoPerfil(false)} title="Editar perfil do paciente" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditandoPerfil(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-paciente" type="submit">Salvar</button>
          </>
        }
      >
        {editandoPerfil && <PacienteForm paciente={paciente} onSubmit={salvarPerfil} />}
      </Modal>

      <FotoPacienteModal aberto={fotoAberta} onFechar={() => setFotoAberta(false)} fotoAtual={paciente.foto} onSalvar={salvarFoto} />

      <ReciboModal
        aberto={Boolean(reciboModal)}
        onFechar={() => setReciboModal(null)}
        pagamento={reciboModal?.pagamento || null}
        pacientes={[paciente]}
        dentistas={dentistas}
      />
    </div>
  );
}
