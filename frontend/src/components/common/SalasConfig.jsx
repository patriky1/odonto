import { useEffect, useState } from 'react';
import { DoorOpen, Plus, Pencil, Check, X, RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirmacao } from './ConfirmDialog';

/** Cadastro das salas de atendimento usadas na agenda (somente admin). */
export default function SalasConfig() {
  const confirmar = useConfirmacao();
  const [salas, setSalas] = useState([]);
  const [nova, setNova] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');

  const carregar = () => api.get('/salas', { params: { todas: true } }).then((r) => setSalas(r.data)).catch(() => {});
  useEffect(() => { carregar(); }, []);

  const adicionar = async (e) => {
    e.preventDefault();
    if (!nova.trim()) return;
    try {
      await api.post('/salas', { nome: nova.trim() });
      setNova('');
      toast.success('Sala cadastrada');
      carregar();
    } catch { /* noop */ }
  };

  const salvarNome = async (id) => {
    if (!nomeEdicao.trim()) return;
    try {
      await api.put(`/salas/${id}`, { nome: nomeEdicao.trim() });
      setEditandoId(null);
      carregar();
    } catch { /* noop */ }
  };

  const desativar = async (s) => {
    const ok = await confirmar({
      titulo: 'Desativar sala',
      item: s.nome,
      mensagem: 'A sala deixa de aparecer para novos agendamentos. Os agendamentos antigos continuam mostrando o nome dela.',
      aviso: 'Você pode reativar a sala depois.',
      palavra: 'DESATIVAR',
      textoBotao: 'Desativar sala',
    });
    if (!ok) return;
    try { await api.delete(`/salas/${s.id}`); carregar(); } catch { /* noop */ }
  };

  const reativar = async (s) => {
    try { await api.put(`/salas/${s.id}`, { ativo: true }); carregar(); } catch { /* noop */ }
  };

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h3 className="card-title"><DoorOpen size={16} style={{ display: 'inline', marginRight: 6 }} />Salas de atendimento</h3>
      </div>
      <p className="text-sm text-muted mb-4">
        As salas aparecem no agendamento. Uma sala não pode ter dois atendimentos no mesmo horário;
        já o mesmo dentista pode atender em paralelo, desde que em salas diferentes.
      </p>

      <form onSubmit={adicionar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 520, marginBottom: 16 }}>
        <input className="form-control" style={{ flex: '1 1 220px' }} value={nova} onChange={(e) => setNova(e.target.value)}
          placeholder="Ex.: Sala 1, Consultório 2, Sala de Ortodontia" aria-label="Nome da nova sala" />
        <button type="submit" className="btn btn-primary" disabled={!nova.trim()}><Plus size={15} /> Adicionar sala</button>
      </form>

      {salas.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma sala cadastrada. Sem salas, a agenda funciona como antes (conflito por dentista).</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 520 }}>
          {salas.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, opacity: s.ativo ? 1 : 0.6 }}>
              {editandoId === s.id ? (
                <>
                  <input className="form-control" style={{ flex: 1, padding: '6px 10px' }} value={nomeEdicao} autoFocus
                    onChange={(e) => setNomeEdicao(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); salvarNome(s.id); } if (e.key === 'Escape') setEditandoId(null); }} />
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => salvarNome(s.id)} title="Salvar"><Check size={15} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditandoId(null)} title="Cancelar"><X size={15} /></button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 500 }}>{s.nome}</span>
                  {!s.ativo && <span className="badge badge-gray">Desativada</span>}
                  {s.ativo ? (
                    <>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditandoId(s.id); setNomeEdicao(s.nome); }} title="Renomear"><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => desativar(s)} title="Desativar"><Trash2 size={14} /></button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => reativar(s)}><RotateCcw size={13} /> Reativar</button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
