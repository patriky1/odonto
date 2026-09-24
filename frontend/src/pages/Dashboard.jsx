import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, CheckCircle, XCircle, DollarSign, UserPlus, Bell, Star, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../services/api';
import { ValorProtegido, BlocoProtegido } from '../components/common/ValorProtegido';
import { formatCurrency, formatDate, getStatusAgendamento, dataISO } from '../utils/formatters';
import LinkPaciente from '../components/common/LinkPaciente';
import AgendaPage from './Agenda/AgendaPage';
import useIsMobile from '../hooks/useIsMobile';
import { useAuth } from '../contexts/AuthContext';

function StatCard({ icon: Icon, label, value, color, sub, protegido, onClick, dica }) {
  const clicavel = !!onClick;
  return (
    <div
      className={`stat-card${clicavel ? ' clicavel' : ''}`}
      onClick={onClick}
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      title={dica}
      onKeyDown={clicavel ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">
            {protegido ? <ValorProtegido marcador="•••••">{value}</ValorProtegido> : value}
          </p>
          {sub && <p className="text-sm text-muted">{sub}</p>}
        </div>
        <div className="stat-icon" style={{ background: color + '20' }}>
          <Icon size={22} color={color} />
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS = { concluido: '#10b981', agendado: '#2563eb', cancelado: '#ef4444', confirmado: '#6366f1', em_atendimento: '#f59e0b', nao_compareceu: '#94a3b8' };

const saudacao = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

/**
 * Página inicial no celular: só o essencial — saudação, aniversariantes
 * do dia (se houver) e a agenda do dia, já com as ações à mão.
 * Gráficos e números gerais ficam para a tela do computador.
 */
function InicioMobile() {
  const { usuario } = useAuth();
  const [aniversariantes, setAniversariantes] = useState([]);

  useEffect(() => {
    const hoje = dataISO(new Date()).slice(5); // MM-DD
    api.get('/dashboard')
      .then((r) => setAniversariantes((r.data.aniversariantes || []).filter((p) => String(p.dataNascimento || '').slice(5, 10) === hoje)))
      .catch(() => {});
  }, []);

  const hojeExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <div className="inicio-m-saudacao">
        <h1>{saudacao()}, {usuario?.nome?.split(' ')[0] || ''}!</h1>
        <p>{hojeExtenso}</p>
      </div>

      {aniversariantes.length > 0 && (
        <div className="card inicio-m-aniversario">
          <span style={{ fontSize: 22 }}>🎂</span>
          <div style={{ minWidth: 0 }}>
            <p className="text-sm font-semibold">Aniversário hoje</p>
            <p className="text-sm">
              {aniversariantes.map((p, i) => (
                <span key={p.id}>{i > 0 && ', '}<LinkPaciente id={p.id} nome={p.nome} /></span>
              ))}
            </p>
          </div>
        </div>
      )}

      <AgendaPage inicio />
    </div>
  );
}

export default function Dashboard() {
  const isMobile = useIsMobile();
  return isMobile ? <InicioMobile /> : <DashboardCompleto />;
}

function DashboardCompleto() {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const abrirAgenda = (data = dataISO(new Date())) => navigate(`/agenda?view=dia&data=${String(data).split('T')[0]}`);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setDados(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!dados) return null;

  const pieData = (dados.agendamentosPorStatus || []).map(s => ({
    name: getStatusAgendamento(s.status).label,
    value: s.quantidade,
    color: STATUS_COLORS[s.status] || '#94a3b8',
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral do consultório</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-4">
        <StatCard icon={Users} label="Total de Pacientes" value={dados.totalPacientes} color="#2563eb" />
        <StatCard icon={Calendar} label="Consultas Hoje" value={dados.consultasHoje} sub={`${dados.consultasConcluidas} concluídas · ver agenda`} color="#10b981"
          onClick={() => abrirAgenda()} dica="Abrir a agenda de hoje" />
        <StatCard icon={XCircle} label="Cancelamentos" value={dados.consultasCanceladas} sub="hoje" color="#ef4444"
          onClick={() => abrirAgenda()} dica="Abrir a agenda de hoje" />
        <StatCard icon={DollarSign} label="Faturamento do Mês" value={formatCurrency(dados.faturamentoMes)} color="#f59e0b" protegido />
      </div>

      <div className="grid-4 mb-4">
        <StatCard icon={UserPlus} label="Novos Pacientes (Mês)" value={dados.novosPacientesMes} color="#6366f1" />
        <StatCard icon={Bell} label="Pagamentos Pendentes" value={dados.pagamentosPendentes} color="#f59e0b" />
        <StatCard icon={Star} label="Aniversariantes Hoje" value={dados.aniversariantes?.length || 0} color="#db2777" />
        <StatCard icon={Clock} label="Próximos Atendimentos" value={dados.proximosAtendimentos?.length || 0} color="#0891b2"
          onClick={() => navigate('/agenda?view=semana')} dica="Abrir a agenda da semana" />
      </div>

      <div className="grid-2 mb-4">
        
        <div className="card">
          <div className="card-header"><h3 className="card-title">Faturamento Mensal</h3></div>
          <BlocoProtegido altura={220}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dados.faturamentoMensal || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" fill="var(--primary)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          </BlocoProtegido>
        </div>

        
        <div className="card">
          <div className="card-header"><h3 className="card-title">Agendamentos do Dia</h3></div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}  paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" color="#63783d" iconSize={10} formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>Sem dados de agendamentos</p></div>}
        </div>
      </div>

      <div className="grid-2">
        {/* Próximos atendimentos */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Próximos Atendimentos</h3></div>
          {dados.proximosAtendimentos?.length === 0 ? (
            <div className="empty-state"><p>Nenhum atendimento agendado</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dados.proximosAtendimentos?.slice(0, 6).map(ag => {
                const status = getStatusAgendamento(ag.status);
                return (
                  <div key={ag.id} className="clicavel" onClick={() => abrirAgenda(ag.data)} title="Abrir na agenda"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderBottom: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-light)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>{formatDate(ag.data).slice(0,5)}</span>
                      <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{ag.horaInicio}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }} className="truncate"><LinkPaciente id={ag.pacienteId} nome={ag.pacienteNome} /></p>
                      <p className="text-sm text-muted truncate">{ag.dentistaNome} · {ag.procedimentoNome || 'Consulta'}</p>
                    </div>
                    <span className={`badge ${status.className}`}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Aniversariantes */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">🎂 Aniversariantes do Mês</h3></div>
          {dados.aniversariantes?.length === 0 ? (
            <div className="empty-state"><p>Nenhum aniversariante hoje</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dados.aniversariantes?.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎂</div>
                  <div>
                    <p style={{ fontWeight: 600 }}><LinkPaciente id={p.id} nome={p.nome} /></p>
                    <p className="text-sm text-muted">{p.telefone || p.email || 'Sem contato cadastrado'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
