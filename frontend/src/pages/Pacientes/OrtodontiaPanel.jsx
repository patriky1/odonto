import { useState, useEffect, useCallback } from 'react';
import { Plus, Braces, Trash2, Pencil, Calendar, DollarSign, Check, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatDate, formatCurrency } from '../../utils/formatters';

const hojeISO = () => new Date().toISOString().split('T')[0];
const fmt = (d) => (d ? String(d).split('T')[0] : '');

/*
 * Ordem de exibição da lista.
 * false (padrão) = a lista cresce para baixo: o registro mais recente
 *                   fica na última linha (o mais antigo fica no topo).
 * true            = inverte: o mais recente aparece no topo da lista.
 *
 * O backend sempre devolve do mais novo pro mais antigo (data DESC, id DESC);
 * a ordenação de exibição é resolvida aqui, isolada, pra ser fácil de trocar.
 */
const NOVOS_REGISTROS_NO_TOPO = false;
const ordenarParaExibicao = (lista) => (NOVOS_REGISTROS_NO_TOPO ? lista : [...lista].reverse());

/** Linha inline de criação/edição — sem modal, direto na tabela da aba. */
function LinhaRegistroForm({ registro, onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({
    data: fmt(registro?.data) || hojeISO(),
    trabalhoRealizado: registro?.trabalhoRealizado || '',
    trabalhoRealizar: registro?.trabalhoRealizar || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const salvar = () => {
    if (!form.trabalhoRealizado.trim() && !form.trabalhoRealizar.trim()) {
      toast.error('Preencha ao menos um dos campos de trabalho');
      return;
    }
    onSalvar(form);
  };

  return (
    <tr>
      <td>
        <input type="date" className="form-control" value={form.data} onChange={set('data')} style={{ minWidth: 150 }} />
      </td>
      <td>
        <input
          className="form-control"
          value={form.trabalhoRealizado}
          onChange={set('trabalhoRealizado')}
          placeholder="Trabalho realizado no paciente"
          autoFocus
        />
      </td>
      <td>
        <input
          className="form-control"
          value={form.trabalhoRealizar}
          onChange={set('trabalhoRealizar')}
          placeholder="Trabalho a realizar"
        />
      </td>
      <td>
        <div className="actions">
          <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando} title="Salvar">
            <Check size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancelar} disabled={salvando} title="Cancelar">
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function OrtodontiaPanel({ pacienteId }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    api.get(`/ortodontia/paciente/${pacienteId}`)
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const criar = async (form) => {
    setSalvando(true);
    try {
      await api.post(`/ortodontia/paciente/${pacienteId}`, form);
      toast.success('Registro adicionado');
      setCriando(false);
      carregar();
    } catch { /* toast já exibido pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  const atualizar = async (id, form) => {
    setSalvando(true);
    try {
      await api.put(`/ortodontia/${id}`, form);
      toast.success('Registro atualizado');
      setEditandoId(null);
      carregar();
    } catch { /* noop */ } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id) => {
    if (!confirm('Remover este registro do histórico?')) return;
    try {
      await api.delete(`/ortodontia/${id}`);
      toast.success('Registro removido');
      carregar();
    } catch { /* noop */ }
  };

  const registros = ordenarParaExibicao(dados?.registros || []);
  const linhaNova = (
    <LinhaRegistroForm onSalvar={criar} onCancelar={() => setCriando(false)} salvando={salvando} />
  );

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
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setEditandoId(null); setCriando(true); }}
          disabled={criando}
        >
          <Plus size={15} /> Novo registro
        </button>
      </div>

      {carregando ? <div className="loading"><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Data</th>
                <th>Trabalho realizado no paciente</th>
                <th>Trabalho a realizar</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {NOVOS_REGISTROS_NO_TOPO && criando && linhaNova}

              {registros.map((r) => (
                editandoId === r.id ? (
                  <LinhaRegistroForm
                    key={r.id}
                    registro={r}
                    salvando={salvando}
                    onSalvar={(form) => atualizar(r.id, form)}
                    onCancelar={() => setEditandoId(null)}
                  />
                ) : (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.data)}</td>
                    <td>{r.trabalhoRealizado || '—'}</td>
                    <td>{r.trabalhoRealizar || '—'}</td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => { setCriando(false); setEditandoId(r.id); }}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Excluir" style={{ color: 'var(--danger)' }} onClick={() => excluir(r.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}

              {!NOVOS_REGISTROS_NO_TOPO && criando && linhaNova}

              {registros.length === 0 && !criando && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <Braces size={40} />
                      <h3>Nenhum procedimento ortodôntico registrado</h3>
                      <p className="text-sm text-muted">Clique em "Novo registro" para começar o acompanhamento deste paciente.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}