import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Activity, Search, Images, X, List, ChevronDown, ChevronUp, Save, Eraser, UserPlus } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import FotoUpload from '../../components/common/FotoUpload';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { formatCurrency, getStatusTratamento } from '../../utils/formatters';

const FORM_VAZIO = {
  pacienteId: '',
  nome: '',
  descricao: '',
  valor: '',
  sessoes: 1,
  sessoesRealizadas: 0,
  status: 'nao_iniciado',
  dentistaId: '',
  fotoAntes: '',
  fotoDepois: '',
};

/**
 * Formulário de tratamento.
 * modo="simples"  -> só o essencial na tela; o resto fica atrás de "Mais opções".
 *                    Traz os próprios botões Limpar / Salvar (usado direto na página).
 * modo="completo" -> todos os campos de uma vez (usado no modal de edição).
 */
function TratamentoForm({ id = 'form-tratamento', tratamento, pacientes, dentistas, onSubmit, modo = 'completo', salvando = false }) {
  const simples = modo === 'simples';
  // null vindo do banco viraria input "não controlado" — cai no valor vazio padrão
  const [form, setForm] = useState(() => {
    const inicial = { ...FORM_VAZIO };
    if (tratamento) {
      Object.keys(FORM_VAZIO).forEach(k => {
        if (tratamento[k] !== null && tratamento[k] !== undefined) inicial[k] = tratamento[k];
      });
    }
    return inicial;
  });
  const [avancado, setAvancado] = useState(!simples);
  const [buscaPaciente, setBuscaPaciente] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setFoto = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const limpar = () => {
    setForm({ ...FORM_VAZIO });
    setBuscaPaciente('');
    setAvancado(false);
  };

  // Com muitos pacientes cadastrados, o filtro evita rolar a lista inteira
  const pacientesFiltrados = useMemo(() => {
    const termo = buscaPaciente.trim().toLowerCase();
    if (!termo) return pacientes;
    return pacientes.filter(p => p.nome?.toLowerCase().includes(termo));
  }, [pacientes, buscaPaciente]);

  const enviar = (e) => {
    e.preventDefault();
    // Em modo simples o formulário se limpa depois de salvar, para cadastrar o próximo
    onSubmit(form, simples ? limpar : undefined);
  };

  return (
    <form id={id} onSubmit={enviar}>
      <div className="form-group">
        <label className="form-label">Paciente <span className="required">*</span></label>
        {simples && pacientes.length > 8 && (
          <div className="search-input" style={{ marginBottom: 8 }}>
            <Search size={16} className="search-icon" />
            <input
              className="form-control"
              placeholder="Filtrar paciente pelo nome..."
              value={buscaPaciente}
              onChange={e => setBuscaPaciente(e.target.value)}
            />
          </div>
        )}
        <select className="form-control" value={form.pacienteId} onChange={set('pacienteId')} required>
          <option value="">Selecione o paciente</option>
          {pacientesFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {simples && buscaPaciente && pacientesFiltrados.length === 0 && (
          <p className="text-xs text-muted">Nenhum paciente encontrado com esse nome.</p>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Nome do Tratamento <span className="required">*</span></label>
        <input className="form-control" value={form.nome} onChange={set('nome')} required placeholder="Ex: Tratamento Ortodôntico Completo" />
      </div>

      <div className="form-row-3">
        <div className="form-group">
          <label className="form-label">Valor (R$)</label>
          <input type="number" step="0.01" className="form-control" value={form.valor} onChange={set('valor')} placeholder="0,00" />
        </div>
        <div className="form-group">
          <label className="form-label">Total de Sessões</label>
          <input type="number" className="form-control" value={form.sessoes} onChange={set('sessoes')} min={1} />
        </div>
        <div className="form-group">
          <label className="form-label">Dentista responsável</label>
          <select className="form-control" value={form.dentistaId} onChange={set('dentistaId')}>
            <option value="">Selecione</option>
            {(dentistas || []).map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
      </div>

      {simples && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 12 }}
          onClick={() => setAvancado(a => !a)}
        >
          {avancado ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {avancado ? 'Menos opções' : 'Mais opções (descrição, status e fotos)'}
        </button>
      )}

      {avancado && (
        <>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea className="form-control" value={form.descricao} onChange={set('descricao')} placeholder="Descrição do tratamento..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sessões Realizadas</label>
              <input type="number" className="form-control" value={form.sessoesRealizadas} onChange={set('sessoesRealizadas')} min={0} max={form.sessoes} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" value={form.status} onChange={set('status')}>
                <option value="nao_iniciado">Não Iniciado</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Fotos do antes e depois — ambas opcionais */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 12 }}>
              Registro fotográfico
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <FotoUpload label="Foto ANTES do tratamento" valor={form.fotoAntes} onChange={setFoto('fotoAntes')}
                ajuda="JPG, PNG ou WebP" />
              <FotoUpload label="Foto DEPOIS do tratamento" valor={form.fotoDepois} onChange={setFoto('fotoDepois')}
                ajuda="JPG, PNG ou WebP" />
            </div>
            <p className="text-xs text-muted">
              As imagens são reduzidas automaticamente antes do envio e ficam vinculadas a este tratamento.
            </p>
          </div>
        </>
      )}

      {simples && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
          <button type="button" className="btn btn-secondary" onClick={limpar} disabled={salvando}>
            <Eraser size={15} /> Limpar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar tratamento'}
          </button>
        </div>
      )}
    </form>
  );
}

/** Visualização lado a lado do antes e depois. */
function ComparativoFotos({ tratamento }) {
  if (!tratamento) return null;
  const box = { flex: '1 1 260px', textAlign: 'center' };
  const img = { width: '100%', borderRadius: 8, border: '1px solid var(--border)', maxHeight: 420, objectFit: 'contain', background: 'var(--bg)' };

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={box}>
        <p className="text-sm font-semibold mb-2">ANTES</p>
        {tratamento.fotoAntes
          ? <img src={tratamento.fotoAntes} alt="Antes do tratamento" style={img} />
          : <div className="empty-state" style={{ padding: 40 }}><Images size={32} /><p className="text-sm">Sem foto</p></div>}
      </div>
      <div style={box}>
        <p className="text-sm font-semibold mb-2">DEPOIS</p>
        {tratamento.fotoDepois
          ? <img src={tratamento.fotoDepois} alt="Depois do tratamento" style={img} />
          : <div className="empty-state" style={{ padding: 40 }}><Images size={32} /><p className="text-sm">Sem foto</p></div>}
      </div>
    </div>
  );
}

export default function TratamentosList() {
  const confirmar = useConfirmacao();
  const [tratamentos, setTratamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [dentistas, setDentistas] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [verFotos, setVerFotos] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // Ao entrar pelo menu, a página abre direto no cadastro de um novo tratamento
  const [vista, setVista] = useState('novo');

  const carregar = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filtroStatus) params.status = filtroStatus;
    api.get('/tratamentos', { params }).then(r => setTratamentos(r.data)).finally(() => setLoading(false));
  }, [filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    api.get('/pacientes', { params: { limite: 500 } }).then(r => setPacientes(r.data.pacientes || [])).catch(() => {});
    api.get('/dentistas').then(r => setDentistas(r.data)).catch(() => {});
  }, []);

  const handleSalvar = async (data, aoConcluir) => {
    setSalvando(true);
    try {
      if (editando) { await api.put(`/tratamentos/${editando.id}`, data); toast.success('Tratamento atualizado!'); }
      else { await api.post('/tratamentos', data); toast.success('Tratamento cadastrado!'); }
      setModalOpen(false);
      setEditando(null);
      aoConcluir?.();
      carregar();
    } catch { /* mensagem já exibida pelo interceptor */ }
    finally { setSalvando(false); }
  };

  const handleExcluir = async (t) => {
    const ok = await confirmar({
      titulo: 'Excluir tratamento',
      item: `${t.nome} — ${t.paciente?.nome || ''}`,
      mensagem: 'As fotos de antes e depois deste tratamento também serão apagadas.',
    });
    if (!ok) return;
    try {
      await api.delete(`/tratamentos/${t.id}`);
      toast.success('Excluído');
      carregar();
    } catch { /* noop */ }
  };

  const filtrados = tratamentos.filter(t => t.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) || t.nome?.toLowerCase().includes(busca.toLowerCase()));

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
        <div className="card" style={{ maxWidth: 'auto' }}>
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
            <TratamentoForm
              id="form-novo-tratamento"
              pacientes={pacientes}
              dentistas={dentistas}
              onSubmit={handleSalvar}
              modo="simples"
              salvando={salvando}
            />
          )}
        </div>
      ) : (
        <div className="card">
          <div className="search-bar">
            <div className="search-input">
              <Search size={16} className="search-icon" />
              <input className="form-control" placeholder="Buscar por paciente ou tratamento..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <select className="form-control" style={{ maxWidth: 180 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="nao_iniciado">Não Iniciado</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table className="table table-cards">
                <thead><tr><th>Paciente</th><th>Tratamento</th><th>Sessões</th><th>Valor</th><th>Fotos</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {filtrados.map(t => {
                    const st = getStatusTratamento(t.status);
                    const pct = t.sessoes > 0 ? Math.round((t.sessoesRealizadas / t.sessoes) * 100) : 0;
                    return (
                      <tr key={t.id}>
                        <td className="td-titulo" style={{ fontWeight: 600 }}>{t.paciente?.nome}</td>
                        <td data-label="Tratamento">
                          <div>
                            <p style={{ fontWeight: 500 }}>{t.nome}</p>
                            {t.descricao && <p className="text-sm text-muted truncate" style={{ maxWidth: 200 }}>{t.descricao}</p>}
                          </div>
                        </td>
                        <td data-label="Sessões">
                          <div>
                            <p className="text-sm">{t.sessoesRealizadas}/{t.sessoes}</p>
                            <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', borderRadius: 2 }} />
                            </div>
                          </div>
                        </td>
                        <td data-label="Valor">{formatCurrency(t.valor)}</td>
                        <td data-label="Fotos">
                          {(t.fotoAntes || t.fotoDepois) ? (
                            <button className="btn btn-ghost btn-sm" title="Ver antes e depois" onClick={() => setVerFotos(t)}>
                              <Images size={15} />
                              <span className="text-xs" style={{ marginLeft: 4 }}>
                                {[t.fotoAntes && 'antes', t.fotoDepois && 'depois'].filter(Boolean).join(' + ')}
                              </span>
                            </button>
                          ) : <span className="text-muted text-sm">—</span>}
                        </td>
                        <td data-label="Status"><span className={`badge ${st.className}`}>{st.label}</span></td>
                        <td className="td-acoes">
                          <div className="actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(t); setModalOpen(true); }}>Editar</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleExcluir(t)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtrados.length === 0 && <tr><td colSpan={7}><div className="empty-state"><Activity size={40} /><h3>Nenhum tratamento encontrado</h3></div></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditando(null); }} title={editando ? 'Editar Tratamento' : 'Novo Tratamento'} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditando(null); }}>Cancelar</button><button className="btn btn-primary" form="form-tratamento" type="submit">Salvar</button></>}>
        <TratamentoForm key={editando?.id || 'novo'} tratamento={editando} pacientes={pacientes} dentistas={dentistas} onSubmit={handleSalvar} />
      </Modal>

      <Modal
        open={!!verFotos}
        onClose={() => setVerFotos(null)}
        size="lg"
        title={verFotos ? `Antes e depois — ${verFotos.nome}` : ''}
        footer={<button className="btn btn-secondary" onClick={() => setVerFotos(null)}><X size={15} /> Fechar</button>}
      >
        <ComparativoFotos tratamento={verFotos} />
      </Modal>
    </div>
  );
}
