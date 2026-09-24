import { useState, useEffect, useCallback } from 'react';
import { Plus, Activity, Search, Images, X, List, Save, UserPlus } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import LinkPaciente from '../../components/common/LinkPaciente';
import RegistradoPor from '../../components/common/RegistradoPor';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import TratamentoForm, { textoTratamento } from '../../components/tratamentos/TratamentoForm';
import GaleriaImagens from '../../components/tratamentos/GaleriaImagens';
import toast from 'react-hot-toast';
import { formatDataHoraBanco } from '../../utils/formatters';

export default function TratamentosList() {
  const confirmar = useConfirmacao();
  const [tratamentos, setTratamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [verGaleria, setVerGaleria] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // Ao entrar pelo menu, a página abre direto no cadastro de um novo tratamento
  const [vista, setVista] = useState('novo');
  // Muda a cada cadastro para o formulário voltar limpo
  const [formNovo, setFormNovo] = useState(0);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/tratamentos').then(r => setTratamentos(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    api.get('/pacientes', { params: { limite: 500 } }).then(r => setPacientes(r.data.pacientes || [])).catch(() => {});
  }, []);

  const handleSalvar = async (data) => {
    if (!data.descricao) return toast.error('Descreva o tratamento');
    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/tratamentos/${editando.id}`, { descricao: data.descricao, imagens: data.imagens });
        toast.success('Tratamento atualizado!');
        setEditando(null);
      } else {
        await api.post('/tratamentos', { pacienteId: data.pacienteId, descricao: data.descricao, imagens: data.imagens });
        toast.success('Tratamento cadastrado!');
        setFormNovo((n) => n + 1);
      }
      carregar();
    } catch { /* mensagem já exibida pelo interceptor */ }
    finally { setSalvando(false); }
  };

  const handleExcluir = async (t) => {
    const ok = await confirmar({
      titulo: 'Excluir tratamento',
      item: `${t.nome} — ${t.paciente?.nome || ''}`,
      mensagem: 'As imagens da galeria deste tratamento também serão apagadas.',
    });
    if (!ok) return;
    try {
      await api.delete(`/tratamentos/${t.id}`);
      toast.success('Excluído');
      carregar();
    } catch { /* noop */ }
  };

  const termo = busca.toLowerCase();
  const filtrados = tratamentos.filter(t => t.paciente?.nome?.toLowerCase().includes(termo) || textoTratamento(t).toLowerCase().includes(termo));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tratamentos</h1>
          <p>
            {vista === 'novo'
              ? 'Cadastre um novo tratamento para um paciente'
              : `${tratamentos.length} tratamento${tratamentos.length !== 1 ? 's' : ''} de todos os pacientes`}
          </p>
        </div>
        {vista === 'novo' ? (
          <button className="btn btn-secondary" onClick={() => setVista('lista')}>
            <List size={16} /> Ver tratamentos de todos os pacientes
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => { setVista('novo'); setBusca(''); }}>
            <Plus size={16} /> Novo Tratamento
          </button>
        )}
      </div>

      {vista === 'novo' ? (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={18} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>Novo Tratamento</h3>
            </div>
          </div>

          {pacientes.length === 0 ? (
            <div className="empty-state">
              <Activity size={40} />
              <h3>Nenhum paciente cadastrado</h3>
              <p className="text-sm text-muted">Cadastre um paciente antes de criar um tratamento.</p>
            </div>
          ) : (
            <>
              <TratamentoForm key={formNovo} id="form-novo-tratamento" pacientes={pacientes} onSubmit={handleSalvar} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
                <button type="submit" form="form-novo-tratamento" className="btn btn-primary" disabled={salvando}>
                  <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar tratamento'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="search-bar">
            <div className="search-input">
              <Search size={16} className="search-icon" />
              <input className="form-control" placeholder="Buscar por paciente ou tratamento..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>

          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table className="table table-cards">
                <thead><tr><th>Paciente</th><th>Tratamento</th><th>Imagens</th><th>Data</th><th>Ações</th></tr></thead>
                <tbody>
                  {filtrados.map(t => (
                    <tr key={t.id}>
                      <td className="td-titulo" style={{ fontWeight: 600 }}>
                        <LinkPaciente id={t.pacienteId} nome={t.paciente?.nome} />
                        <RegistradoPor registro={t} />
                      </td>
                      <td data-label="Tratamento">
                        <p className="text-sm" style={{ whiteSpace: 'pre-wrap', maxWidth: 420, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {textoTratamento(t)}
                        </p>
                      </td>
                      <td data-label="Imagens">
                        {t.imagens.length > 0 ? (
                          <button className="btn btn-ghost btn-sm" title="Ver galeria" onClick={() => setVerGaleria(t)}>
                            <Images size={15} /><span className="text-xs" style={{ marginLeft: 4 }}>{t.imagens.length}</span>
                          </button>
                        ) : <span className="text-muted text-sm">—</span>}
                      </td>
                      <td data-label="Data" className="text-sm">{formatDataHoraBanco(t.createdAt)}</td>
                      <td className="td-acoes">
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditando(t)}>Editar</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleExcluir(t)}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && <tr><td colSpan={5}><div className="empty-state"><Activity size={40} /><h3>Nenhum tratamento encontrado</h3></div></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={Boolean(editando)} onClose={() => setEditando(null)} title="Editar Tratamento" size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button><button className="btn btn-primary" form="form-tratamento" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button></>}>
        {editando && <RegistradoPor registro={editando} variante="bloco" />}
        {editando && <TratamentoForm key={editando.id} tratamento={editando} onSubmit={handleSalvar} />}
      </Modal>

      <Modal
        open={!!verGaleria}
        onClose={() => setVerGaleria(null)}
        size="lg"
        title={verGaleria ? `Galeria — ${verGaleria.paciente?.nome || verGaleria.nome}` : ''}
        footer={<button className="btn btn-secondary" onClick={() => setVerGaleria(null)}><X size={15} /> Fechar</button>}
      >
        {verGaleria && <GaleriaImagens imagens={verGaleria.imagens} tamanho={120} />}
      </Modal>
    </div>
  );
}
