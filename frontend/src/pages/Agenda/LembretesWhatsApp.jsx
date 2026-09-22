import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, CheckCircle, RotateCcw, PhoneOff, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import LinkPaciente from '../../components/common/LinkPaciente';
import { dataISO, formatDate, formatDateTime, getStatusAgendamento, numeroWhatsApp, paraData } from '../../utils/formatters';

/**
 * Lembretes de consulta pelo WhatsApp (envio em um clique).
 *
 * O sistema monta a mensagem e abre a conversa do paciente no WhatsApp
 * (Web ou aplicativo) já com o texto pronto — a recepção só aperta enviar.
 * O envio 100% automático exige um serviço pago de API do WhatsApp.
 */

const CHAVE_MODELO = 'odonto_modelo_lembrete';
const MODELO_PADRAO =
  'Olá, {paciente}! Passando para lembrar da sua consulta no Consultório Dr. Murilo Abrantes ' +
  '{quando}, {data}, às {hora}, com {dentista}. Podemos confirmar sua presença? Responda SIM para confirmar.';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const amanha = () => { const d = new Date(); d.setDate(d.getDate() + 1); return dataISO(d); };

const montarMensagem = (modelo, ag) => {
  const dia = paraData(ag.data);
  const hoje = dataISO(new Date());
  const quando = ag.data === amanha() ? 'amanhã' : ag.data === hoje ? 'hoje' : `na ${DIAS[dia.getDay()]}`;
  return modelo
    .replaceAll('{paciente}', (ag.pacienteNome || '').split(' ')[0])
    .replaceAll('{quando}', quando)
    .replaceAll('{data}', formatDate(ag.data))
    .replaceAll('{hora}', ag.horaInicio)
    .replaceAll('{dentista}', ag.dentistaNome || 'o dentista')
    .replaceAll('{sala}', ag.salaNome || '')
    .replaceAll('{procedimento}', ag.procedimentoNome || 'consulta');
};

export default function LembretesWhatsApp({ aberto, onFechar }) {
  const [data, setData] = useState(amanha());
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [editandoModelo, setEditandoModelo] = useState(false);
  const [modelo, setModelo] = useState(() => {
    try { return localStorage.getItem(CHAVE_MODELO) || MODELO_PADRAO; } catch { return MODELO_PADRAO; }
  });

  const carregar = useCallback(() => {
    setCarregando(true);
    api.get('/agendamentos/lembretes', { params: { data } })
      .then((r) => setLista(r.data.agendamentos))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [data]);

  useEffect(() => { if (aberto) carregar(); }, [aberto, carregar]);

  const salvarModelo = () => {
    try { localStorage.setItem(CHAVE_MODELO, modelo); } catch { /* noop */ }
    setEditandoModelo(false);
    toast.success('Mensagem salva neste computador');
  };

  const enviar = async (ag) => {
    const numero = numeroWhatsApp(ag.pacienteWhatsapp || ag.pacienteTelefone);
    if (!numero) { toast.error('Telefone do paciente inválido. Corrija no cadastro.'); return; }
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(montarMensagem(modelo, ag))}`;
    window.open(url, '_blank', 'noopener');
    try {
      const { data: atualizado } = await api.patch(`/agendamentos/${ag.id}/lembrete`, { enviado: true });
      setLista((l) => l.map((x) => (x.id === ag.id ? { ...x, lembreteEnviadoEm: atualizado.lembreteEnviadoEm } : x)));
    } catch { /* noop */ }
  };

  const desfazerEnvio = async (ag) => {
    try {
      await api.patch(`/agendamentos/${ag.id}/lembrete`, { enviado: false });
      setLista((l) => l.map((x) => (x.id === ag.id ? { ...x, lembreteEnviadoEm: null } : x)));
    } catch { /* noop */ }
  };

  const confirmarPresenca = async (ag) => {
    try {
      await api.patch(`/agendamentos/${ag.id}/status`, { status: 'confirmado' });
      setLista((l) => l.map((x) => (x.id === ag.id ? { ...x, status: 'confirmado' } : x)));
      toast.success(`${ag.pacienteNome} confirmado`);
    } catch { /* noop */ }
  };

  const enviados = lista.filter((a) => a.lembreteEnviadoEm).length;

  return (
    <Modal open={aberto} onClose={onFechar} size="lg" title="Lembretes pelo WhatsApp"
      footer={<button className="btn btn-secondary" onClick={onFechar}>Fechar</button>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="data-lembretes">Consultas do dia</label>
          <input id="data-lembretes" type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <span className="badge badge-info" style={{ marginBottom: 8 }}>{enviados} de {lista.length} enviados</span>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', marginBottom: 4 }} onClick={() => setEditandoModelo((v) => !v)}>
          <Pencil size={14} /> Editar mensagem
        </button>
      </div>

      {editandoModelo && (
        <div style={{ background: 'var(--bg)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
          <label className="form-label" htmlFor="modelo-lembrete">Texto do lembrete</label>
          <textarea id="modelo-lembrete" className="form-control" style={{ minHeight: 90 }} value={modelo} onChange={(e) => setModelo(e.target.value)} />
          <p className="text-xs text-muted mt-1">
            Campos automáticos: {'{paciente}'} {'{quando}'} {'{data}'} {'{hora}'} {'{dentista}'} {'{procedimento}'} {'{sala}'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={salvarModelo}>Salvar mensagem</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setModelo(MODELO_PADRAO)}>Voltar ao texto padrão</button>
          </div>
        </div>
      )}

      {carregando ? <div className="loading"><div className="spinner" /></div> : lista.length === 0 ? (
        <div className="empty-state"><MessageCircle size={36} /><h3>Nenhuma consulta para lembrar neste dia</h3></div>
      ) : (
        <div className="table-wrapper">
          <table className="table table-cards">
            <thead><tr><th>Hora</th><th>Paciente</th><th>Dentista</th><th>Status</th><th>Lembrete</th></tr></thead>
            <tbody>
              {lista.map((ag) => {
                const st = getStatusAgendamento(ag.status);
                const numero = numeroWhatsApp(ag.pacienteWhatsapp || ag.pacienteTelefone);
                return (
                  <tr key={ag.id}>
                    <td data-label="Hora"><strong>{ag.horaInicio}</strong></td>
                    <td data-label="Paciente">
                      <div>
                        <div style={{ fontWeight: 600 }}><LinkPaciente id={ag.pacienteId} nome={ag.pacienteNome} /></div>
                        <div className="text-xs text-muted">{ag.pacienteWhatsapp || ag.pacienteTelefone || 'Sem telefone'}</div>
                      </div>
                    </td>
                    <td data-label="Dentista">{ag.dentistaNome}</td>
                    <td data-label="Status"><span className={`badge ${st.className}`}>{st.label}</span></td>
                    <td className="td-acoes">
                      <div className="actions" style={{ alignItems: 'center' }}>
                        {!numero ? (
                          <span className="text-xs" style={{ color: 'var(--danger)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                            <PhoneOff size={13} /> Telefone inválido
                          </span>
                        ) : ag.lembreteEnviadoEm ? (
                          <>
                            <span className="text-xs text-success" title={`Enviado em ${formatDateTime(`${ag.lembreteEnviadoEm.replace(' ', 'T')}Z`)}`}>
                              <CheckCircle size={13} style={{ verticalAlign: -2 }} /> Enviado
                            </span>
                            <button className="btn btn-ghost btn-sm" onClick={() => enviar(ag)} title="Abrir a conversa novamente">Reenviar</button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => desfazerEnvio(ag)} title="Marcar como não enviado"><RotateCcw size={13} /></button>
                          </>
                        ) : (
                          <button className="btn btn-success btn-sm" onClick={() => enviar(ag)}>
                            <MessageCircle size={14} /> Enviar
                          </button>
                        )}
                        {ag.status === 'agendado' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => confirmarPresenca(ag)} title="O paciente respondeu confirmando">
                            Confirmou
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted mt-2">
        O botão abre o WhatsApp com a mensagem pronta; é só apertar enviar. Quando o paciente responder, clique em "Confirmou".
      </p>
    </Modal>
  );
}
