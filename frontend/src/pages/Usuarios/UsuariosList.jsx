import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, KeyRound } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import { getInitials, getAvatarColor, formatDate, formatDateTime } from '../../utils/formatters';

const PERFIS = { admin: { label: 'Administrador', className: 'badge-danger', icon: '👑' }, dentista: { label: 'Dentista', className: 'badge-primary', icon: '🦷' }, recepcionista: { label: 'Recepcionista', className: 'badge-info', icon: '💁' } };

function UsuarioForm({ usuario, onSubmit, focoSenha }) {
  const [form, setForm] = useState({ nome: usuario?.nome || '', email: usuario?.email || '', senha: '', perfil: usuario?.perfil || 'recepcionista', ativo: usuario?.ativo ?? true });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <form id="form-usuario" onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-group">
        <label className="form-label">Nome <span className="required">*</span></label>
        <input className="form-control" value={form.nome} onChange={set('nome')} required placeholder="Nome completo" />
      </div>
      <div className="form-group">
        <label className="form-label">E-mail <span className="required">*</span></label>
        <input type="email" className="form-control" value={form.email} onChange={set('email')} required placeholder="email@exemplo.com" />
      </div>
      <div className="form-group">
        <label className="form-label">{usuario ? 'Nova Senha (deixe em branco para manter)' : 'Senha'} {!usuario && <span className="required">*</span>}</label>
        <input type="password" className="form-control" value={form.senha} onChange={set('senha')} required={!usuario || focoSenha} placeholder="••••••••" minLength={6} autoFocus={focoSenha} autoComplete="new-password" />
        {focoSenha && <p className="text-xs text-muted mt-1">Defina uma senha provisória e informe à pessoa. Ela pode trocar depois em Configurações.</p>}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Perfil</label>
          <select className="form-control" value={form.perfil} onChange={set('perfil')}>
            <option value="admin">Administrador</option>
            <option value="dentista">Dentista</option>
            <option value="recepcionista">Recepcionista</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-control" value={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.value === 'true' }))}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
      </div>
    </form>
  );
}

export default function UsuariosList() {
  const { usuario: eu, isAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [redefinindo, setRedefinindo] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const confirmar = useConfirmacao();

  const carregar = () => {
    setLoading(true);
    api.get('/usuarios').then(r => setUsuarios(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get('/usuarios/pedidos-senha').then(r => setPedidos(r.data)).catch(() => {});
  };
  useEffect(() => { if (isAdmin) carregar(); else setLoading(false); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const fecharModal = () => { setModalOpen(false); setEditando(null); setRedefinindo(false); };

  const redefinirSenhaDe = (usuarioId) => {
    const u = usuarios.find((x) => x.id === usuarioId);
    if (!u) return;
    setEditando(u); setRedefinindo(true); setModalOpen(true);
  };

  const descartarPedido = async (p) => {
    try {
      await api.delete(`/usuarios/pedidos-senha/${p.usuarioId}`);
      setPedidos((l) => l.filter((x) => x.usuarioId !== p.usuarioId));
    } catch { /* noop */ }
  };

  const handleSalvar = async (data) => {
    if (!data.senha) delete data.senha;
    try {
      if (editando) { await api.put(`/usuarios/${editando.id}`, data); toast.success(data.senha ? 'Usuário atualizado e senha redefinida!' : 'Usuário atualizado!'); }
      else { await api.post('/usuarios', data); toast.success('Usuário criado!'); }
      fecharModal(); carregar();
    } catch { /* mensagem já exibida pelo interceptor */ }
  };

  const handleExcluir = async (id, nome) => {
    if (id === eu.id) { toast.error('Você não pode excluir sua própria conta'); return; }
    const ok = await confirmar({
      titulo: 'Desativar usuário',
      item: nome,
      mensagem: 'A pessoa não conseguirá mais entrar no sistema. Para reativar, edite o usuário e marque "Ativo".',
      aviso: 'O acesso é bloqueado imediatamente.',
      palavra: 'DESATIVAR',
      textoBotao: 'Desativar usuário',
    });
    if (!ok) return;
    try {
      await api.delete(`/usuarios/${id}`); toast.success('Usuário desativado'); carregar();
    } catch { /* noop */ }
  };

  if (!isAdmin) return <div className="empty-state"><ShieldCheck size={48} /><h3>Acesso Restrito</h3><p>Apenas administradores podem gerenciar usuários.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Usuários</h1><p>{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}</p></div>
        <button className="btn btn-primary" onClick={() => { setEditando(null); setModalOpen(true); }}><Plus size={16} /> Novo Usuário</button>
      </div>

      {pedidos.length > 0 && (
        <div className="card mb-4" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <KeyRound size={18} color="#b45309" />
            <strong style={{ fontSize: 14 }}>Pedidos de "Esqueci minha senha"</strong>
          </div>
          {pedidos.map((p) => (
            <div key={p.usuarioId} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{p.nome}</div>
                <div className="text-xs text-muted">
                  {p.email} · pedido em {formatDateTime(`${p.pedidoEm.replace(' ', 'T')}Z`)}
                  {p.emailEnviado ? ' · link enviado por e-mail' : ' · e-mail não configurado'}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => redefinirSenhaDe(p.usuarioId)}>Definir nova senha</button>
              <button className="btn btn-ghost btn-sm" onClick={() => descartarPedido(p)} title="A pessoa já resolveu">Descartar</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table className="table table-cards">
              <thead><tr><th>Usuário</th><th>Perfil</th><th>Criado em</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {usuarios.map(u => {
                  const perfil = PERFIS[u.perfil] || { label: u.perfil, className: 'badge-gray', icon: '👤' };
                  return (
                    <tr key={u.id}>
                      <td className="td-titulo">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ background: getAvatarColor(u.id), width: 34, height: 34, fontSize: 12 }}>{getInitials(u.nome)}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.nome} {u.id === eu.id && <span className="badge badge-gray" style={{ fontSize: 10 }}>Você</span>}</div>
                            <div className="text-sm text-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Perfil"><span className={`badge ${perfil.className}`}>{perfil.icon} {perfil.label}</span></td>
                      <td data-label="Criado em" className="text-muted">{formatDate(u.createdAt)}</td>
                      <td data-label="Status"><span className={`badge ${u.ativo ? 'badge-success' : 'badge-gray'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="td-acoes">
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditando(u); setModalOpen(true); }} title="Editar"><Pencil size={14} /></button>
                          {u.id !== eu.id && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleExcluir(u.id, u.nome)} title="Desativar"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={fecharModal} title={redefinindo ? 'Definir nova senha' : editando ? 'Editar Usuário' : 'Novo Usuário'}
        footer={<><button className="btn btn-secondary" onClick={fecharModal}>Cancelar</button><button className="btn btn-primary" form="form-usuario" type="submit">Salvar</button></>}>
        <UsuarioForm key={`${editando?.id || 'novo'}-${redefinindo}`} usuario={editando} onSubmit={handleSalvar} focoSenha={redefinindo} />
      </Modal>
    </div>
  );
}
