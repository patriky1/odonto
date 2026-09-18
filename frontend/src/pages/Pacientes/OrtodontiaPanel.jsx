import { useState, useEffect, useCallback } from 'react';
import { Plus, Braces, Trash2, Pencil, Calendar, DollarSign } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { formatDate, formatCurrency, dataISO } from '../../utils/formatters';
import { useConfirmacao } from '../../components/common/ConfirmDialog';

const hojeISO = () => dataISO(new Date());
const fmt = (d) => (d ? String(d).split('T')[0] : '');

function RegistroForm({ registro, opcoes, dentistas, onSubmit }) {
  const [form, setForm] = useState({
    data: fmt(registro?.data) || hojeISO(),
    dentistaId: registro?.dentistaId || '',
    tipoAparelho: registro?.tipoAparelho || '',
    procedimento: registro?.procedimento || '',
    arcada: registro?.arcada || '',
    dentes: registro?.dentes || '',
    fioUtilizado: registro?.fioUtilizado || '',
    elasticos: registro?.elasticos || '',
    forcaAplicada: registro?.forcaAplicada || '',
    queixas: registro?.queixas || '',
    orientacoes: registro?.orientacoes || '',
    proximaConsulta: fmt(registro?.proximaConsulta),
    valor: registro?.valor ?? '',
    observacoes: registro?.observacoes || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form id="form-ortodontia" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Data <span className="required">*</span></label>
          <input type="date" className="form-control" value={form.data} onChange={set('data')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Dentista responsável</label>
          <select className="form-control" value={form.dentistaId} onChange={set('dentistaId')}>
            <option value="">Selecione</option>
            {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Procedimento <span className="required">*</span></label>
          <select className="form-control" value={form.procedimento} onChange={set('procedimento')} required>
            <option value="">Selecione</option>
            {(opcoes.procedimentos || []).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo de aparelho</label>
          <select className="form-control" value={form.tipoAparelho} onChange={set('tipoAparelho')}>
            <option value="">Selecione</option>
            {(opcoes.tiposAparelho || []).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Arcada</label>
          <select className="form-control" value={form.arcada} onChange={set('arcada')}>
            <option value="">Não se aplica</option>
            {(opcoes.arcadas || []).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Dentes envolvidos</label>
          <input className="form-control" value={form.dentes} onChange={set('dentes')} placeholder="Ex: 13, 23, 36" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Fio utilizado</label>
          <input className="form-control" value={form.fioUtilizado} onChange={set('fioUtilizado')} placeholder="Ex: NiTi 0.014" />
        </div>
        <div className="form-group">
          <label className="form-label">Elásticos</label>
          <input className="form-control" value={form.elasticos} onChange={set('elasticos')} placeholder="Ex: Classe II 3/16 médio" />
        </div>
        <div className="form-group">
          <label className="form-label">Força aplicada</label>
          <input className="form-control" value={form.forcaAplicada} onChange={set('forcaAplicada')} placeholder="Ex: 150 g" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Queixas do paciente</label>
        <textarea className="form-control" value={form.queixas} onChange={set('queixas')} placeholder="Relato do paciente nesta sessão..." />
      </div>

      <div className="form-group">
        <label className="form-label">Orientações dadas</label>
        <textarea className="form-control" value={form.orientacoes} onChange={set('orientacoes')} placeholder="Higiene, uso de elásticos, alimentação..." />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Próxima consulta</label>
          <input type="date" className="form-control" value={form.proximaConsulta} onChange={set('proximaConsulta')} />
        </div>
        <div className="form-group">
          <label className="form-label">Valor cobrado (R$)</label>
          <input type="number" step="0.01" min="0" className="form-control" value={form.valor} onChange={set('valor')} placeholder="0,00" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Observações</label>
        <textarea className="form-control" value={form.observacoes} onChange={set('observacoes')} />
      </div>
    </form>
  );
}

export default function OrtodontiaPanel({ pacienteId }) {
  const confirmar = useConfirmacao();
  const [dados, setDados] = useState(null);
  const [opcoes, setOpcoes] = useState({});
  const [dentistas, setDentistas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    api.get(`/ortodontia/paciente/${pacienteId}`)
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    api.get('/ortodontia/opcoes').then((r) => setOpcoes(r.data)).catch(() => {});
    api.get('/dentistas').then((r) => setDentistas(r.data)).catch(() => {});
  }, []);

  const salvar = async (form) => {
    try {
      if (editando) await api.put(`/ortodontia/${editando.id}`, form);
      else await api.post(`/ortodontia/paciente/${pacienteId}`, form);
      toast.success(editando ? 'Registro atualizado' : 'Procedimento registrado');
      setModal(false); setEditando(null); carregar();
    } catch { /* noop */ }
  };

  const excluir = async (r) => {
    const ok = await confirmar({
      titulo: 'Excluir registro ortodôntico',
      item: `${r.procedimento} — ${formatDate(r.data)}`,
    });
    if (!ok) return;
    const { id } = r;
    try {
      await api.delete(`/ortodontia/${id}`);
      toast.success('Registro removido');
      carregar();
    } catch { /* noop */ }
  };

  const registros = dados?.registros || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {dados?.aparelhoAtual && <span className="badge badge-primary"><Braces size={12} /> {dados.aparelhoAtual}</span>}
          <span className="badge badge-gray">{dados?.total || 0} atendimento(s)</span>
          {dados?.totalInvestido > 0 && (
            <span className="badge badge-success"><DollarSign size={12} /> {formatCurrency(dados.totalInvestido)}</span>
          )}
          {dados?.proximaConsulta && (
            <span className="badge badge-info"><Calendar size={12} /> Próxima: {formatDate(dados.proximaConsulta)}</span>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditando(null); setModal(true); }}>
          <Plus size={15} /> Novo registro
        </button>
      </div>

      {carregando ? <div className="loading"><div className="spinner" /></div> : registros.length === 0 ? (
        <div className="empty-state">
          <Braces size={40} />
          <h3>Nenhum procedimento ortodôntico registrado</h3>
          <p className="text-sm text-muted">Registre instalações, manutenções e trocas de fio deste paciente.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table table-cards">
            <thead>
              <tr>
                <th>Data</th><th>Procedimento</th><th>Aparelho</th><th>Arcada</th>
                <th>Fio / Elásticos</th><th>Próxima</th><th style={{ textAlign: 'right' }}>Valor</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td data-label="Data">{formatDate(r.data)}</td>
                  <td className="td-titulo" style={{ fontWeight: 600 }}>
                    {r.procedimento}
                    {r.dentistaNome && <div className="text-xs text-muted">{r.dentistaNome}</div>}
                    {r.dentes && <div className="text-xs text-muted">Dentes: {r.dentes}</div>}
                  </td>
                  <td data-label="Aparelho">{r.tipoAparelho || '—'}</td>
                  <td data-label="Arcada">{r.arcada || '—'}</td>
                  <td data-label="Fio / Elásticos" className="text-sm">
                    <div>
                      {r.fioUtilizado || '—'}
                      {r.elasticos && <div className="text-xs text-muted">{r.elasticos}</div>}
                    </div>
                  </td>
                  <td data-label="Próxima">{formatDate(r.proximaConsulta)}</td>
                  <td data-label="Valor" style={{ textAlign: 'right' }}>{r.valor ? formatCurrency(r.valor) : '—'}</td>
                  <td className="td-acoes">
                    <div className="actions">
                      <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => { setEditando(r); setModal(true); }}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" title="Excluir" style={{ color: 'var(--danger)' }} onClick={() => excluir(r)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalhes textuais do último atendimento */}
      {registros[0] && (registros[0].queixas || registros[0].orientacoes || registros[0].observacoes) && (
        <div style={{ marginTop: 16, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
          <p className="text-xs text-muted" style={{ fontWeight: 700, marginBottom: 8 }}>
            ÚLTIMO ATENDIMENTO — {formatDate(registros[0].data)}
          </p>
          {registros[0].queixas && <p className="text-sm"><strong>Queixas:</strong> {registros[0].queixas}</p>}
          {registros[0].orientacoes && <p className="text-sm"><strong>Orientações:</strong> {registros[0].orientacoes}</p>}
          {registros[0].observacoes && <p className="text-sm"><strong>Observações:</strong> {registros[0].observacoes}</p>}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditando(null); }}
        size="lg"
        title={editando ? 'Editar procedimento ortodôntico' : 'Novo procedimento ortodôntico'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setModal(false); setEditando(null); }}>Cancelar</button>
            <button className="btn btn-primary" form="form-ortodontia" type="submit">Salvar</button>
          </>
        }
      >
        <RegistroForm key={editando?.id || 'novo'} registro={editando} opcoes={opcoes} dentistas={dentistas} onSubmit={salvar} />
      </Modal>
    </div>
  );
}
