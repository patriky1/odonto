import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, FileText, DollarSign, Activity, Smile,
  ClipboardList, Braces, ExternalLink, AlertTriangle, Building2, Camera, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import FotoPacienteModal, { AvatarPaciente } from '../../components/common/FotoPaciente';
import AnamneseForm from './AnamneseForm';
import OrtodontiaPanel from './OrtodontiaPanel';
import ReciboModal from '../../components/common/ReciboModal';
import { formatDate, formatCPF, calcularIdade, formatCurrency, getStatusAgendamento, getStatusPagamento } from '../../utils/formatters';

export default function PacienteDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState(null);
  const [aba, setAba] = useState('info');
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

  useEffect(() => {
    api.get(`/pacientes/${id}`).then(r => setPaciente(r.data)).catch(() => {}).finally(() => setLoading(false));
    // Alertas clínicos aparecem no topo da ficha, em qualquer aba
    api.get(`/anamnese/paciente/${id}`).then(r => setAlertasAnamnese(r.data.alertas || [])).catch(() => {});
    api.get('/dentistas').then(r => setDentistas(r.data)).catch(() => {});
  }, [id]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!paciente) return <div className="empty-state"><h3>Paciente não encontrado</h3></div>;

  const aba_items = [
    { id: 'info', label: 'Dados', icon: User },
    { id: 'anamnese', label: 'Anamnese', icon: ClipboardList },
    { id: 'ortodontia', label: 'Ortodontia', icon: Braces },
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
          <button className="btn btn-secondary" onClick={() => setReciboModal({})}>
            <Receipt size={16} /> Emitir recibo
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/odontograma?paciente=${paciente.id}`)}>
            <Smile size={16} /> Odontograma
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
            {paciente.email && <span className="text-sm text-muted"><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />{paciente.email}</span>}
            {paciente.cidadeAtendimento && (
              <span className="badge badge-info"><Building2 size={12} /> Atendido em {paciente.cidadeAtendimento}</span>
            )}
          </div>
          {paciente.linkIdoc && (
            <a href={paciente.linkIdoc} target="_blank" rel="noopener noreferrer"
              className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>
              <ExternalLink size={14} /> Abrir página no iDoc
            </a>
          )}
        </div>
      </div>

      <div className="tabs">
        {aba_items.map(({ id: aId, label, icon: Icon }) => (
          <button key={aId} className={`tab ${aba === aId ? 'active' : ''}`} onClick={() => setAba(aId)}>
            <Icon size={14} style={{ display: 'inline', marginRight: 6 }} />{label}
          </button>
        ))}
      </div>

      {aba === 'info' && (
        <div className="card">
          <div className="form-row">
            {[
              { label: 'Endereço', value: paciente.endereco },
              { label: 'Cidade/UF', value: paciente.cidade && `${paciente.cidade}/${paciente.estado}` },
              { label: 'CEP', value: paciente.cep },
              { label: 'WhatsApp', value: paciente.whatsapp },
              { label: 'Responsável', value: paciente.responsavel },
              { label: 'Cidade de atendimento', value: paciente.cidadeAtendimento },
              { label: 'Link do iDoc', value: paciente.linkIdoc, link: true },
            ].map(({ label, value, link }) => value && (
              <div key={label}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</p>
                {link ? (
                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary truncate"
                    style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 260 }}>
                    <ExternalLink size={13} /> Abrir no iDoc
                  </a>
                ) : (
                  <p style={{ fontWeight: 500 }}>{value}</p>
                )}
              </div>
            ))}
          </div>
          {paciente.observacoes && (
            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Observações</p>
              <p style={{ fontSize: 14 }}>{paciente.observacoes}</p>
            </div>
          )}
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
                      <td data-label="Data">{formatDate(ag.data)}</td>
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

      {aba === 'tratamentos' && (
        <div className="card">
          <h3 className="card-title mb-4">Tratamentos</h3>
          {(paciente.tratamentos || []).length === 0 ? <div className="empty-state"><p>Nenhum tratamento registrado</p></div> : (
            paciente.tratamentos.map(t => (
              <div key={t.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{t.nome}</p>
                    {t.descricao && <p className="text-sm text-muted">{t.descricao}</p>}
                    <p className="text-sm text-muted mt-1">{t.sessoesRealizadas}/{t.sessoes} sessões · {formatCurrency(t.valor)}</p>
                  </div>
                  <span className={`badge ${t.status === 'concluido' ? 'badge-success' : t.status === 'em_andamento' ? 'badge-warning' : 'badge-gray'}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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
                      <td className="td-titulo">{pg.descricao}</td>
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
