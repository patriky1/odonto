import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, User } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import PacienteForm from './PacienteForm';
import { AvatarPaciente } from '../../components/common/FotoPaciente';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import { formatDate, formatCPF, calcularIdade } from '../../utils/formatters';
import toast from 'react-hot-toast';

export default function PacientesList() {
  const navigate = useNavigate();
  const confirmar = useConfirmacao();
  const [pacientes, setPacientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [pagina, setPagina] = useState(1);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/pacientes', { params: { busca, pagina, limite: 20 } })
      .then(r => { setPacientes(r.data.pacientes); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [busca, pagina]);

  useEffect(() => { const t = setTimeout(carregar, 300); return () => clearTimeout(t); }, [carregar]);

  const handleSalvar = async (data) => {
    if (editando) {
      await api.put(`/pacientes/${editando.id}`, data);
      toast.success('Paciente atualizado!');
    } else {
      await api.post('/pacientes', data);
      toast.success('Paciente cadastrado!');
    }
    setModalOpen(false);
    setEditando(null);
    carregar();
  };

  const handleExcluir = async (id, nome) => {
    const ok = await confirmar({
      titulo: 'Excluir paciente',
      item: nome,
      mensagem: 'O paciente sai da lista e das buscas. O histórico de consultas e pagamentos continua guardado no sistema.',
      aviso: 'Para trazer o paciente de volta será preciso ajuda técnica.',
    });
    if (!ok) return;
    try {
      await api.delete(`/pacientes/${id}`);
      toast.success('Paciente excluído');
      carregar();
    } catch { /* mensagem já exibida pelo interceptor */ }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pacientes</h1>
          <p>{total} paciente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditando(null); setModalOpen(true); }}>
          <Plus size={16} /> Novo Paciente
        </button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input">
            <Search size={16} className="search-icon" />
            <input className="form-control" placeholder="Buscar por nome, CPF, e-mail..." value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} />
          </div>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <>
            <div className="table-wrapper">
              <table className="table table-cards">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>CPF</th>
                    <th>Nascimento / Idade</th>
                    <th>Telefone</th>
                    <th>Cidade/UF</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><User size={40} /><h3>Nenhum paciente encontrado</h3></div></td></tr>
                  ) : pacientes.map(p => (
                    <tr key={p.id}>
                      <td className="td-titulo">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/pacientes/${p.id}`)}>
                          <AvatarPaciente paciente={p} tamanho={36} fonte={12} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{p.nome}</div>
                            {p.email && <div className="text-sm text-muted" style={{ wordBreak: 'break-all' }}>{p.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td data-label="CPF">{formatCPF(p.cpf)}</td>
                      <td data-label="Nascimento">{p.dataNascimento ? `${formatDate(p.dataNascimento)} (${calcularIdade(p.dataNascimento)} anos)` : '-'}</td>
                      <td data-label="Telefone">{p.telefone || p.whatsapp || '-'}</td>
                      <td data-label="Cidade/UF">{p.cidade ? `${p.cidade}/${p.estado}` : '-'}</td>
                      <td className="td-acoes">
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/pacientes/${p.id}`)} title="Ver detalhes"><Eye size={15} /></button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditando(p); setModalOpen(true); }} title="Editar"><Pencil size={15} /></button>
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleExcluir(p.id, p.nome)} title="Excluir"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                <button className="btn btn-secondary btn-sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
                <span style={{ padding: '6px 12px', fontSize: 13 }}>{pagina} / {totalPages}</span>
                <button className="btn btn-secondary btn-sm" disabled={pagina === totalPages} onClick={() => setPagina(p => p + 1)}>Próxima</button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditando(null); }} title={editando ? 'Editar Paciente' : 'Novo Paciente'} size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditando(null); }}>Cancelar</button>
            <button className="btn btn-primary" form="form-paciente" type="submit">Salvar</button>
          </>
        }
      >
        <PacienteForm paciente={editando} onSubmit={handleSalvar} />
      </Modal>
    </div>
  );
}
