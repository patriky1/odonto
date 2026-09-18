import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Search } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../utils/formatters';

function ProntuarioForm({ prontuario, pacientes, dentistas, onSubmit }) {
  const [form, setForm] = useState({
    pacienteId: prontuario?.pacienteId || '',
    dentistaId: prontuario?.dentistaId || '',
    queixaPrincipal: prontuario?.queixaPrincipal || '',
    historico: prontuario?.historico || '',
    diagnostico: prontuario?.diagnostico || '',
    observacoes: prontuario?.observacoes || '',
    evolucao: prontuario?.evolucao || '',
    procedimentos: prontuario?.procedimentos || '',
    medicamentos: prontuario?.medicamentos || '',
    anotacoes: prontuario?.anotacoes || '',
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <form id="form-prontuario" onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Paciente <span className="required">*</span></label>
          <select className="form-control" value={form.pacienteId} onChange={set('pacienteId')} required>
            <option value="">Selecione</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Dentista</label>
          <select className="form-control" value={form.dentistaId} onChange={set('dentistaId')}>
            <option value="">Selecione</option>
            {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
      </div>
      {[
        { k: 'queixaPrincipal', label: 'Queixa Principal' },
        { k: 'historico', label: 'Histórico do Paciente' },
        { k: 'diagnostico', label: 'Diagnóstico' },
        { k: 'observacoes', label: 'Observações Clínicas' },
        { k: 'evolucao', label: 'Evolução do Tratamento' },
        { k: 'procedimentos', label: 'Procedimentos Realizados' },
        { k: 'medicamentos', label: 'Medicamentos Prescritos' },
        { k: 'anotacoes', label: 'Anotações do Dentista' },
      ].map(({ k, label }) => (
        <div className="form-group" key={k}>
          <label className="form-label">{label}</label>
          <textarea className="form-control" value={form[k]} onChange={set(k)} placeholder={label + '...'} style={{ minHeight: 60 }} />
        </div>
      ))}
    </form>
  );
}

export default function ProntuariosList() {
  const [prontuarios, setProntuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [visualizando, setVisualizando] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [dentistas, setDentistas] = useState([]);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/prontuarios').then(r => setProntuarios(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
    api.get('/pacientes', { params: { limite: 500 } }).then(r => setPacientes(r.data.pacientes));
    api.get('/dentistas').then(r => setDentistas(r.data));
  }, [carregar]);

  const handleSalvar = async (data) => {
    if (editando) { await api.put(`/prontuarios/${editando.id}`, data); toast.success('Prontuário atualizado!'); }
    else { await api.post('/prontuarios', data); toast.success('Prontuário registrado!'); }
    setModalOpen(false); setEditando(null); carregar();
  };

  const filtrados = prontuarios.filter(p =>
    p.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.dentista?.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1>Prontuários</h1><p>{prontuarios.length} registro{prontuarios.length !== 1 ? 's' : ''}</p></div>
        <button className="btn btn-primary" onClick={() => { setEditando(null); setModalOpen(true); }}><Plus size={16} /> Novo Prontuário</button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input">
            <Search size={16} className="search-icon" />
            <input className="form-control" placeholder="Buscar por paciente ou dentista..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table className="table table-cards">
              <thead><tr><th>Paciente</th><th>Data</th><th>Dentista</th><th>Queixa Principal</th><th>Ações</th></tr></thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id}>
                    <td className="td-titulo" style={{ fontWeight: 600 }}>{p.paciente?.nome}</td>
                    <td data-label="Data" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(p.data)}</td>
                    <td data-label="Dentista">{p.dentista?.nome || '—'}</td>
                    <td data-label="Queixa" className="truncate" style={{ maxWidth: 240 }}>{p.queixaPrincipal || '—'}</td>
                    <td className="td-acoes">
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setVisualizando(p)}>Ver</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(p); setModalOpen(true); }}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && <tr><td colSpan={5}><div className="empty-state"><FileText size={40} /><h3>Nenhum prontuário encontrado</h3></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visualizar */}
      <Modal open={!!visualizando} onClose={() => setVisualizando(null)} title="Prontuário" size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setVisualizando(null)}>Fechar</button><button className="btn btn-primary" onClick={() => { setEditando(visualizando); setVisualizando(null); setModalOpen(true); }}>Editar</button></>}>
        {visualizando && (
          <div>
            <div style={{ display: 'flex', gap: '12px 24px', flexWrap: 'wrap', marginBottom: 20, padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
              <div><span className="text-muted text-sm">Paciente</span><p style={{ fontWeight: 700 }}>{visualizando.paciente?.nome}</p></div>
              <div><span className="text-muted text-sm">Dentista</span><p style={{ fontWeight: 700 }}>{visualizando.dentista?.nome || '—'}</p></div>
              <div><span className="text-muted text-sm">Data</span><p style={{ fontWeight: 700 }}>{formatDateTime(visualizando.data)}</p></div>
            </div>
            {[
              { k: 'queixaPrincipal', label: 'Queixa Principal' },
              { k: 'historico', label: 'Histórico' },
              { k: 'diagnostico', label: 'Diagnóstico' },
              { k: 'observacoes', label: 'Observações Clínicas' },
              { k: 'evolucao', label: 'Evolução' },
              { k: 'procedimentos', label: 'Procedimentos' },
              { k: 'medicamentos', label: 'Medicamentos' },
              { k: 'anotacoes', label: 'Anotações' },
            ].filter(({ k }) => visualizando[k]).map(({ k, label }) => (
              <div key={k} style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                <p style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{visualizando[k]}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditando(null); }} title={editando ? 'Editar Prontuário' : 'Novo Prontuário'} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditando(null); }}>Cancelar</button><button className="btn btn-primary" form="form-prontuario" type="submit">Salvar</button></>}>
        <ProntuarioForm prontuario={editando} pacientes={pacientes} dentistas={dentistas} onSubmit={handleSalvar} />
      </Modal>
    </div>
  );
}
