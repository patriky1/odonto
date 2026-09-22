import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Stethoscope, Phone, Mail } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { getInitials, getAvatarColor } from '../../utils/formatters';

const DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const DIAS_LABELS = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb', domingo: 'Dom' };

function DentistaForm({ dentista, usuarios, onSubmit }) {
  const parseDias = () => {
    try { return dentista?.diasAtendimento ? JSON.parse(dentista.diasAtendimento) : []; } catch { return []; }
  };
  const parseHorarios = () => {
    try { return dentista?.horariosDisponiveis ? JSON.parse(dentista.horariosDisponiveis) : { inicio: '08:00', fim: '18:00' }; } catch { return { inicio: '08:00', fim: '18:00' }; }
  };

  const [form, setForm] = useState({ nome: dentista?.nome || '', cro: dentista?.cro || '', especialidade: dentista?.especialidade || '', telefone: dentista?.telefone || '', email: dentista?.email || '', usuarioId: dentista?.usuarioId || '' });
  const [dias, setDias] = useState(parseDias());
  const [horarios, setHorarios] = useState(parseHorarios());

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleDia = (d) => setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, diasAtendimento: JSON.stringify(dias), horariosDisponiveis: JSON.stringify(horarios) });
  };

  return (
    <form id="form-dentista" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Nome <span className="required">*</span></label>
          <input className="form-control" value={form.nome} onChange={set('nome')} required placeholder="Dr. Nome completo" />
        </div>
        <div className="form-group">
          <label className="form-label">CRO</label>
          <input className="form-control" value={form.cro} onChange={set('cro')} placeholder="CRO-SP 00000" />
        </div>
        <div className="form-group">
          <label className="form-label">Especialidade</label>
          <input className="form-control" value={form.especialidade} onChange={set('especialidade')} placeholder="Clínico Geral, Ortodontia..." />
        </div>
        <div className="form-group">
          <label className="form-label">Telefone</label>
          <input className="form-control" value={form.telefone} onChange={set('telefone')} placeholder="(00) 00000-0000" />
        </div>
        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input type="email" className="form-control" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Usuário do sistema</label>
          <select className="form-control" value={form.usuarioId} onChange={set('usuarioId')}>
            <option value="">Sem vínculo</option>
            {(usuarios || []).map(u => (
              <option key={u.id} value={u.id} disabled={!!u.vinculadoA && u.id !== dentista?.usuarioId}>
                {u.nome} ({u.email}){u.vinculadoA && u.id !== dentista?.usuarioId ? ` — já vinculado a ${u.vinculadoA}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">
            Define de quem é esta agenda: ao entrar no sistema, o usuário vinculado enxerga apenas os agendamentos deste dentista.
          </p>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Dias de Atendimento</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DIAS_SEMANA.map(d => (
            <button key={d} type="button" onClick={() => toggleDia(d)} style={{ padding: '6px 12px', borderRadius: 8, border: `2px solid ${dias.includes(d) ? 'var(--primary)' : 'var(--border)'}`, background: dias.includes(d) ? 'var(--primary-light)' : '#fff', color: dias.includes(d) ? 'var(--primary)' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {DIAS_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Hora Início</label>
          <input type="time" className="form-control" value={horarios.inicio} onChange={e => setHorarios(h => ({ ...h, inicio: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Hora Fim</label>
          <input type="time" className="form-control" value={horarios.fim} onChange={e => setHorarios(h => ({ ...h, fim: e.target.value }))} />
        </div>
      </div>
    </form>
  );
}

export default function DentistasList() {
  const confirmar = useConfirmacao();
  const [dentistas, setDentistas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);

  const carregar = () => {
    setLoading(true);
    api.get('/dentistas').then(r => setDentistas(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get('/dentistas/usuarios-disponiveis').then(r => setUsuarios(r.data)).catch(() => {});
  };
  useEffect(carregar, []);

  const handleSalvar = async (data) => {
    if (editando) { await api.put(`/dentistas/${editando.id}`, data); toast.success('Dentista atualizado!'); }
    else { await api.post('/dentistas', data); toast.success('Dentista cadastrado!'); }
    setModalOpen(false); setEditando(null); carregar();
  };

  const handleExcluir = async (id, nome) => {
    const ok = await confirmar({
      titulo: 'Excluir dentista',
      item: nome,
      mensagem: 'Ele deixa de aparecer na agenda e nos formulários.',
    });
    if (!ok) return;
    try {
      await api.delete(`/dentistas/${id}`); toast.success('Dentista excluído'); carregar();
    } catch { /* mensagem já exibida pelo interceptor */ }
  };

  const parseDias = (d) => { try { return JSON.parse(d || '[]'); } catch { return []; } };

  return (
    <div>
      <div className="page-header">
        <div><h1>Dentistas</h1><p>{dentistas.length} dentista{dentistas.length !== 1 ? 's' : ''} cadastrado{dentistas.length !== 1 ? 's' : ''}</p></div>
        <button className="btn btn-primary" onClick={() => { setEditando(null); setModalOpen(true); }}><Plus size={16} /> Novo Dentista</button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="grid-3">
          {dentistas.map(d => (
            <div key={d.id} className="card">
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                <div className="avatar" style={{ background: getAvatarColor(d.id), width: 48, height: 48, fontSize: 16 }}>{getInitials(d.nome)}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{d.nome}</p>
                  {d.especialidade && <p className="text-sm text-muted">{d.especialidade}</p>}
                  {d.cro && <p className="text-xs text-muted">{d.cro}</p>}
                </div>
              </div>
              {d.telefone && <p className="text-sm" style={{ marginBottom: 4 }}><Phone size={13} style={{ display: 'inline', marginRight: 6, color: 'var(--text-muted)' }} />{d.telefone}</p>}
              {d.email && <p className="text-sm" style={{ marginBottom: 12 }}><Mail size={13} style={{ display: 'inline', marginRight: 6, color: 'var(--text-muted)' }} />{d.email}</p>}
              {parseDias(d.diasAtendimento).length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                  {parseDias(d.diasAtendimento).map(dia => (
                    <span key={dia} className="chip" style={{ fontSize: 11, padding: '2px 8px' }}>{DIAS_LABELS[dia]}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditando(d); setModalOpen(true); }} style={{ flex: 1 }}><Pencil size={14} /> Editar</button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleExcluir(d.id, d.nome)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {dentistas.length === 0 && <div className="card" style={{ gridColumn: '1/-1' }}><div className="empty-state"><Stethoscope size={40} /><h3>Nenhum dentista cadastrado</h3></div></div>}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditando(null); }} title={editando ? 'Editar Dentista' : 'Novo Dentista'}
        footer={<><button className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditando(null); }}>Cancelar</button><button className="btn btn-primary" form="form-dentista" type="submit">Salvar</button></>}>
        <DentistaForm key={editando?.id || 'novo'} dentista={editando} usuarios={usuarios} onSubmit={handleSalvar} />
      </Modal>
    </div>
  );
}
