import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LinkPaciente from '../../components/common/LinkPaciente';
import { formatDataHoraBanco, dataISO } from '../../utils/formatters';

const TIPOS = [
  { value: '', label: 'Todos os registros' },
  { value: 'agendamento', label: 'Agenda' },
  { value: 'tratamento', label: 'Tratamentos' },
  { value: 'orcamento', label: 'Orçamentos' },
  { value: 'pagamento', label: 'Recebimentos' },
  { value: 'receita', label: 'Outras receitas' },
  { value: 'despesa', label: 'Gastos' },
  { value: 'recibo', label: 'Recibos' },
  { value: 'termo', label: 'Termos de consentimento' },
];

const ROTULO_TIPO = Object.fromEntries(TIPOS.filter((t) => t.value).map((t) => [t.value, t.label]));

const COR_ACAO = {
  criou: 'badge-success',
  emitiu: 'badge-success',
  editou: 'badge-blue',
  'alterou status': 'badge-blue',
  'deu baixa': 'badge-primary',
  'registrou assinatura': 'badge-primary',
  excluiu: 'badge-danger',
  cancelou: 'badge-danger',
  revogou: 'badge-orange',
};

const ROTULO_PERFIL = { admin: 'Admin', dentista: 'Dentista', recepcionista: 'Recepção' };

const trintaDiasAtras = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return dataISO(d);
};

export default function AuditoriaPage() {
  const { isAdmin } = useAuth();
  const [filtros, setFiltros] = useState({
    inicio: trintaDiasAtras(), fim: dataISO(new Date()), entidade: '', usuarioId: '', acao: '', busca: '',
  });
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState({ registros: [], total: 0, totalPaginas: 1 });
  const [opcoes, setOpcoes] = useState({ usuarios: [], acoes: [] });
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''));
    api.get('/auditoria', { params: { ...params, pagina, limite: 50 } })
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros, pagina]);

  useEffect(() => { if (isAdmin) carregar(); }, [carregar, isAdmin]);
  useEffect(() => {
    if (isAdmin) api.get('/auditoria/opcoes').then((r) => setOpcoes(r.data)).catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => { setPagina(1); setFiltros((f) => ({ ...f, [k]: e.target.value })); };
  const limpar = () => {
    setPagina(1);
    setFiltros({ inicio: trintaDiasAtras(), fim: dataISO(new Date()), entidade: '', usuarioId: '', acao: '', busca: '' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Registro de atividades</h1>
          <p>Quem criou, alterou ou excluiu cada registro da agenda, dos tratamentos e do financeiro. Visível só para o administrador.</p>
        </div>
      </div>

      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="aud-inicio">De</label>
            <input id="aud-inicio" type="date" className="form-control" value={filtros.inicio} onChange={set('inicio')} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="aud-fim">Até</label>
            <input id="aud-fim" type="date" className="form-control" value={filtros.fim} onChange={set('fim')} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 170 }}>
            <label className="form-label" htmlFor="aud-tipo">Tipo</label>
            <select id="aud-tipo" className="form-control" value={filtros.entidade} onChange={set('entidade')}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 170 }}>
            <label className="form-label" htmlFor="aud-usuario">Usuário</label>
            <select id="aud-usuario" className="form-control" value={filtros.usuarioId} onChange={set('usuarioId')}>
              <option value="">Todos</option>
              {opcoes.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
            <label className="form-label" htmlFor="aud-acao">Ação</label>
            <select id="aud-acao" className="form-control" value={filtros.acao} onChange={set('acao')}>
              <option value="">Todas</option>
              {opcoes.acoes.map((a) => <option key={a} value={a} style={{ textTransform: 'capitalize' }}>{a}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200, position: 'relative' }}>
            <label className="form-label" htmlFor="aud-busca">Buscar</label>
            <Search size={15} style={{ position: 'absolute', left: 10, bottom: 12, color: 'var(--text-muted)' }} />
            <input id="aud-busca" className="form-control" style={{ paddingLeft: 32 }} placeholder="Paciente, descrição ou usuário"
              value={filtros.busca} onChange={set('busca')} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={limpar}><X size={14} /> Limpar filtros</button>
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-muted mb-2">{dados.total} registro{dados.total !== 1 ? 's' : ''} encontrado{dados.total !== 1 ? 's' : ''}</p>
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table className="table table-cards">
              <thead>
                <tr><th>Quando</th><th>Usuário</th><th>Tipo</th><th>Ação</th><th>Registro</th><th>Paciente</th></tr>
              </thead>
              <tbody>
                {dados.registros.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Quando" style={{ whiteSpace: 'nowrap' }}>{formatDataHoraBanco(r.createdAt)}</td>
                    <td className="td-titulo" style={{ fontWeight: 600 }}>
                      {r.usuarioNome || 'Sistema'}
                      {r.usuarioPerfil && (
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 400 }}>
                          {ROTULO_PERFIL[r.usuarioPerfil] || r.usuarioPerfil}
                        </span>
                      )}
                    </td>
                    <td data-label="Tipo">{ROTULO_TIPO[r.entidade] || r.entidade}</td>
                    <td data-label="Ação">
                      <span className={`badge ${COR_ACAO[r.acao] || 'badge-gray'}`}>{r.acao}</span>
                    </td>
                    <td data-label="Registro" style={{ maxWidth: 420 }}>{r.descricao}</td>
                    <td data-label="Paciente">
                      {r.pacienteId ? <LinkPaciente id={r.pacienteId} nome={r.pacienteNome || `#${r.pacienteId}`} /> : '—'}
                    </td>
                  </tr>
                ))}
                {dados.registros.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <ShieldCheck size={40} />
                      <h3>Nenhuma atividade no período</h3>
                      <p className="text-sm text-muted">As ações passam a ser registradas a partir desta atualização do sistema.</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {dados.totalPaginas > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-sm text-muted">Página {pagina} de {dados.totalPaginas}</span>
            <button className="btn btn-secondary btn-sm" disabled={pagina >= dados.totalPaginas} onClick={() => setPagina((p) => p + 1)}>
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
