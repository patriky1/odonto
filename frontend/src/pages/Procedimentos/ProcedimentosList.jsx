import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, ClipboardList } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters';

function ProcedimentoForm({ procedimento, onSubmit }) {
  const [form, setForm] = useState({ nome: procedimento?.nome || '', descricao: procedimento?.descricao || '', valor: procedimento?.valor || '', duracao: procedimento?.duracao || '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <form id="form-procedimento" onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-group">
        <label className="form-label">Nome <span className="required">*</span></label>
        <input className="form-control" value={form.nome} onChange={set('nome')} required placeholder="Nome do procedimento" />
      </div>
      <div className="form-group">
        <label className="form-label">Descrição</label>
        <textarea className="form-control" value={form.descricao} onChange={set('descricao')} placeholder="Descrição..." />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor (R$)</label>
          <input type="number" step="0.01" className="form-control" value={form.valor} onChange={set('valor')} placeholder="0,00" />
        </div>
        <div className="form-group">
          <label className="form-label">Duração (min)</label>
          <input type="number" className="form-control" value={form.duracao} onChange={set('duracao')} placeholder="30" />
        </div>
      </div>
    </form>
  );
}

export default function ProcedimentosList() {
  const confirmar = useConfirmacao();
  const [procedimentos, setProcedimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState('');

  const carregar = () => { setLoading(true); api.get('/procedimentos', { params: { busca } }).then(r => setProcedimentos(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { const t = setTimeout(carregar, 300); return () => clearTimeout(t); }, [busca]);

  const handleSalvar = async (data) => {
    if (editando) { await api.put(`/procedimentos/${editando.id}`, data); toast.success('Procedimento atualizado!'); }
    else { await api.post('/procedimentos', data); toast.success('Procedimento cadastrado!'); }
    setModalOpen(false); setEditando(null); carregar();
  };

  const handleExcluir = async (id, nome) => {
    const ok = await confirmar({ titulo: 'Excluir procedimento', item: nome });
    if (!ok) return;
    try {
      await api.delete(`/procedimentos/${id}`); toast.success('Procedimento excluído'); carregar();
    } catch { /* mensagem já exibida pelo interceptor */ }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Procedimentos</h1><p>{procedimentos.length} procedimento{procedimentos.length !== 1 ? 's' : ''}</p></div>
        <button className="btn btn-primary" onClick={() => { setEditando(null); setModalOpen(true); }}><Plus size={16} /> Novo Procedimento</button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input">
            <Search size={16} className="search-icon" />
            <input className="form-control" placeholder="Buscar procedimento..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table className="table table-cards">
              <thead><tr><th>Nome</th><th>Descrição</th><th>Duração</th><th>Valor</th><th>Ações</th></tr></thead>
              <tbody>
                {procedimentos.map(p => (
                  <tr key={p.id}>
                    <td className="td-titulo" style={{ fontWeight: 600 }}>{p.nome}</td>
                    <td data-label="Descrição" className="text-muted truncate" style={{ maxWidth: 240 }}>{p.descricao || '—'}</td>
                    <td data-label="Duração">{p.duracao ? `${p.duracao} min` : '—'}</td>
                    <td data-label="Valor" style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(p.valor)}</td>
                    <td className="td-acoes">
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditando(p); setModalOpen(true); }} title="Editar"><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleExcluir(p.id, p.nome)} title="Excluir"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {procedimentos.length === 0 && <tr><td colSpan={5}><div className="empty-state"><ClipboardList size={40} /><h3>Nenhum procedimento encontrado</h3></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditando(null); }} title={editando ? 'Editar Procedimento' : 'Novo Procedimento'}
        footer={<><button className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditando(null); }}>Cancelar</button><button className="btn btn-primary" form="form-procedimento" type="submit">Salvar</button></>}>
        <ProcedimentoForm procedimento={editando} onSubmit={handleSalvar} />
      </Modal>
    </div>
  );
}
