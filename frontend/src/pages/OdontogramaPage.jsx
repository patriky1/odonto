import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, Save, Trash2, History, Printer, User, AlertTriangle,
  RotateCcw, FileText, Check, Baby, Smile,
} from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import { useConfirmacao } from '../components/common/ConfirmDialog';
import { formatDate, formatDateTime, formatCPF, calcularIdade } from '../utils/formatters';

/* ================================================================== *
 * CONSTANTES CLÍNICAS (numeração FDI)
 * ================================================================== */

const PERMANENTES_SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const PERMANENTES_INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const DECIDUOS_SUP = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const DECIDUOS_INF = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const STATUS_DENTE = [
  { value: '', label: 'Hígido', color: '#ffffff', border: '#d1d5db' },
  { value: 'cariado', label: 'Cariado', color: '#fef3c7', border: '#f59e0b' },
  { value: 'restaurado', label: 'Restaurado', color: '#dbeafe', border: '#2563eb' },
  { value: 'em_tratamento', label: 'Em tratamento', color: '#fae8ff', border: '#a21caf' },
  { value: 'tratamento_canal', label: 'Canal', color: '#d1fae5', border: '#059669' },
  { value: 'protese', label: 'Prótese', color: '#ede9fe', border: '#7c3aed' },
  { value: 'implante', label: 'Implante', color: '#e0f2fe', border: '#0284c7' },
  { value: 'selante', label: 'Selante', color: '#ecfccb', border: '#65a30d' },
  { value: 'fraturado', label: 'Fraturado', color: '#ffedd5', border: '#ea580c' },
  { value: 'indicado_extracao', label: 'Ind. extração', color: '#ffe4e6', border: '#e11d48' },
  { value: 'ausente', label: 'Ausente', color: '#fee2e2', border: '#ef4444' },
];

const FACES = [
  { value: 'V', label: 'Vestibular' },
  { value: 'L', label: 'Lingual / Palatina' },
  { value: 'M', label: 'Mesial' },
  { value: 'D', label: 'Distal' },
  { value: 'O', label: 'Oclusal / Incisal' },
];

const infoStatus = (valor) => STATUS_DENTE.find((s) => s.value === (valor || '')) || STATUS_DENTE[0];

/* ================================================================== *
 * DENTE — desenho com as 5 faces clicáveis
 * ================================================================== */

function Dente({ numero, dados, selecionado, onSelecionar, faceAtiva, onFace, mostrarNumeroAcima }) {
  const geral = infoStatus(dados?.geral?.status);
  const faces = dados?.faces || {};
  const ausente = dados?.geral?.status === 'ausente';

  const corFace = (f) => (faces[f]?.status ? infoStatus(faces[f].status).color : 'transparent');
  const bordaFace = (f) => (faces[f]?.status ? infoStatus(faces[f].status).border : 'transparent');

  const estiloFace = (f) => ({
    background: corFace(f),
    boxShadow: faceAtiva === f && selecionado ? `inset 0 0 0 2px ${bordaFace(f) === 'transparent' ? '#2563eb' : bordaFace(f)}` : 'none',
    cursor: 'pointer',
    transition: 'background .15s',
  });

  const numeroEl = (
    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, lineHeight: 1 }}>{numero}</span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {mostrarNumeroAcima && numeroEl}
      <div
        onClick={() => onSelecionar(numero)}
        title={`Dente ${numero}${dados?.geral?.status ? ` — ${geral.label}` : ''}`}
        style={{
          width: 32, height: 36, borderRadius: 6,
          border: `2px solid ${selecionado ? '#2563eb' : geral.border}`,
          background: geral.color,
          boxShadow: selecionado ? '0 0 0 3px rgba(37,99,235,.25)' : 'none',
          display: 'grid',
          gridTemplateColumns: '7px 1fr 7px',
          gridTemplateRows: '7px 1fr 7px',
          overflow: 'hidden', position: 'relative', cursor: 'pointer',
          opacity: ausente ? 0.55 : 1,
        }}
      >
        {/* linha 1 */}
        <div />
        <div onClick={(e) => { e.stopPropagation(); onSelecionar(numero); onFace('V'); }} style={estiloFace('V')} title="Vestibular" />
        <div />
        {/* linha 2 */}
        <div onClick={(e) => { e.stopPropagation(); onSelecionar(numero); onFace('M'); }} style={estiloFace('M')} title="Mesial" />
        <div onClick={(e) => { e.stopPropagation(); onSelecionar(numero); onFace('O'); }} style={estiloFace('O')} title="Oclusal / Incisal" />
        <div onClick={(e) => { e.stopPropagation(); onSelecionar(numero); onFace('D'); }} style={estiloFace('D')} title="Distal" />
        {/* linha 3 */}
        <div />
        <div onClick={(e) => { e.stopPropagation(); onSelecionar(numero); onFace('L'); }} style={estiloFace('L')} title="Lingual / Palatina" />
        <div />

        {ausente && (
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, color: '#ef4444', fontWeight: 700, pointerEvents: 'none',
          }}>✕</span>
        )}
      </div>
      {!mostrarNumeroAcima && numeroEl}
    </div>
  );
}

/* ================================================================== *
 * PÁGINA
 * ================================================================== */

export default function OdontogramaPage() {
  const confirmar = useConfirmacao();
  const [searchParams, setSearchParams] = useSearchParams();

  const [pacientes, setPacientes] = useState([]);
  const [pacienteId, setPacienteId] = useState(searchParams.get('paciente') || '');
  const [paciente, setPaciente] = useState(null);
  const [dentes, setDentes] = useState({});
  const [ficha, setFicha] = useState({ queixaPrincipal: '', anamnese: '', alertas: '', observacoesGerais: '' });
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [denticao, setDenticao] = useState('permanente'); // permanente | deciduo

  const [denteSelecionado, setDenteSelecionado] = useState(null);
  const [faceAtiva, setFaceAtiva] = useState(null); // null = dente inteiro
  const [form, setForm] = useState({ status: '', procedimento: '', observacoes: '' });

  const [pendentes, setPendentes] = useState({}); // alterações não salvas: { "11": {...}, "11:V": {...} }
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [salvandoFicha, setSalvandoFicha] = useState(false);
  const areaImpressao = useRef(null);

  const chave = (n, f) => (f ? `${n}:${f}` : String(n));

  /* ------------------------- carregamento ------------------------- */

  useEffect(() => {
    api.get('/pacientes', { params: { limite: 500 } })
      .then((r) => setPacientes(r.data.pacientes))
      .catch(() => {});
  }, []);

  const carregar = useCallback((pid) => {
    if (!pid) {
      setPaciente(null); setDentes({}); setUltimaAtualizacao(null);
      setFicha({ queixaPrincipal: '', anamnese: '', alertas: '', observacoesGerais: '' });
      return;
    }
    setCarregando(true);
    api.get(`/odontograma/paciente/${pid}`)
      .then((r) => {
        setPaciente(r.data.paciente);
        setDentes(r.data.dentes || {});
        setUltimaAtualizacao(r.data.ultimaAtualizacao);
        setFicha({
          queixaPrincipal: r.data.ficha?.queixaPrincipal || '',
          anamnese: r.data.ficha?.anamnese || '',
          alertas: r.data.ficha?.alertas || '',
          observacoesGerais: r.data.ficha?.observacoesGerais || '',
        });
        setPendentes({});
      })
      .catch(() => toast.error('Não foi possível carregar o odontograma'))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(pacienteId); }, [pacienteId, carregar]);

  /* ---------------------- seleção de dente ------------------------ */

  const dadosAtuais = (n, f) => {
    const p = pendentes[chave(n, f)];
    if (p) return p;
    const d = dentes[n];
    if (!d) return null;
    return f ? d.faces?.[f] || null : d.geral;
  };

  const selecionarDente = (numero) => {
    setDenteSelecionado(numero);
    setFaceAtiva(null);
    const d = dadosAtuais(numero, null);
    setForm({ status: d?.status || '', procedimento: d?.procedimento || '', observacoes: d?.observacoes || '' });
  };

  const selecionarFace = (face) => {
    setFaceAtiva(face);
    const d = dadosAtuais(denteSelecionado, face);
    setForm({ status: d?.status || '', procedimento: d?.procedimento || '', observacoes: d?.observacoes || '' });
  };

  const alternarFace = (face) => {
    if (faceAtiva === face) { setFaceAtiva(null); selecionarDente(denteSelecionado); }
    else selecionarFace(face);
  };

  // Ao mudar o formulário, guarda como alteração pendente
  const alterarForm = (campo) => (e) => {
    const valor = e.target.value;
    const novo = { ...form, [campo]: valor };
    setForm(novo);
    if (!denteSelecionado) return;
    setPendentes((p) => ({
      ...p,
      [chave(denteSelecionado, faceAtiva)]: {
        numeroDente: denteSelecionado,
        face: faceAtiva || null,
        ...novo,
      },
    }));
  };

  /* ---------------------------- ações ----------------------------- */

  const salvarDente = async () => {
    if (!pacienteId || !denteSelecionado) return;
    setSalvando(true);
    try {
      await api.post(`/odontograma/paciente/${pacienteId}`, {
        numeroDente: denteSelecionado,
        face: faceAtiva || null,
        ...form,
      });
      toast.success(`Dente ${denteSelecionado}${faceAtiva ? ` (face ${faceAtiva})` : ''} salvo`);
      setPendentes((p) => {
        const copia = { ...p };
        delete copia[chave(denteSelecionado, faceAtiva)];
        return copia;
      });
      carregar(pacienteId);
    } catch { /* toast pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  const salvarTudo = async () => {
    const lista = Object.values(pendentes);
    if (lista.length === 0) return toast('Nenhuma alteração pendente', { icon: 'ℹ️' });
    setSalvando(true);
    try {
      const { data } = await api.post(`/odontograma/paciente/${pacienteId}/lote`, { dentes: lista });
      toast.success(data.mensagem || 'Alterações salvas');
      setPendentes({});
      carregar(pacienteId);
    } catch { /* noop */ } finally {
      setSalvando(false);
    }
  };

  const limparDente = async () => {
    if (!denteSelecionado) return;
    const ok = await confirmar({
      titulo: `Limpar o dente ${denteSelecionado}`,
      mensagem: 'Todos os registros deste dente (em todas as faces) serão removidos do odontograma.',
      textoBotao: 'Limpar dente',
    });
    if (!ok) return;
    try {
      await api.delete(`/odontograma/paciente/${pacienteId}/dente/${denteSelecionado}`);
      toast.success('Registros removidos');
      setForm({ status: '', procedimento: '', observacoes: '' });
      setPendentes((p) => {
        const copia = { ...p };
        Object.keys(copia).forEach((k) => { if (k.startsWith(`${denteSelecionado}`)) delete copia[k]; });
        return copia;
      });
      carregar(pacienteId);
    } catch { /* noop */ }
  };

  const reiniciarOdontograma = async () => {
    const ok = await confirmar({
      titulo: 'Apagar TODO o odontograma',
      mensagem: 'Todos os dentes e faces marcados para este paciente serão apagados.',
      palavra: 'APAGAR TUDO',
      textoBotao: 'Apagar odontograma',
    });
    if (!ok) return;
    try {
      await api.delete(`/odontograma/paciente/${pacienteId}`);
      toast.success('Odontograma reiniciado');
      setDenteSelecionado(null);
      carregar(pacienteId);
    } catch { /* noop */ }
  };

  const salvarFicha = async () => {
    if (!pacienteId) return;
    setSalvandoFicha(true);
    try {
      await api.put(`/odontograma/paciente/${pacienteId}/ficha`, ficha);
      toast.success('Dados clínicos do paciente salvos');
      carregar(pacienteId);
    } catch { /* noop */ } finally {
      setSalvandoFicha(false);
    }
  };

  const abrirHistorico = async () => {
    try {
      const { data } = await api.get(`/odontograma/paciente/${pacienteId}/historico`);
      setHistorico(data);
      setModalHistorico(true);
    } catch { /* noop */ }
  };

  const imprimir = () => window.print();

  const trocarPaciente = (e) => {
    const pid = e.target.value;
    if (Object.keys(pendentes).length > 0 && !confirm('Existem alterações não salvas. Trocar de paciente mesmo assim?')) return;
    setPacienteId(pid);
    setDenteSelecionado(null);
    setFaceAtiva(null);
    setSearchParams(pid ? { paciente: pid } : {});
  };

  /* --------------------------- derivados -------------------------- */

  const resumo = useMemo(() => {
    const contagem = {};
    Object.values(dentes).forEach((d) => {
      const s = d.geral?.status;
      if (s) contagem[s] = (contagem[s] || 0) + 1;
      Object.values(d.faces || {}).forEach((f) => {
        if (f.status) contagem[f.status] = (contagem[f.status] || 0) + 1;
      });
    });
    return Object.entries(contagem)
      .map(([status, total]) => ({ status, total, ...infoStatus(status) }))
      .sort((a, b) => b.total - a.total);
  }, [dentes]);

  const totalPendentes = Object.keys(pendentes).length;
  const arcadaSup = denticao === 'permanente' ? PERMANENTES_SUP : DECIDUOS_SUP;
  const arcadaInf = denticao === 'permanente' ? PERMANENTES_INF : DECIDUOS_INF;

  const dadosDoDente = (n) => {
    const base = dentes[n] ? { ...dentes[n], faces: { ...(dentes[n].faces || {}) } } : { numeroDente: n, geral: null, faces: {} };
    // aplica alterações pendentes na visualização
    Object.entries(pendentes).forEach(([k, v]) => {
      const [num, f] = k.split(':');
      if (parseInt(num) !== n) return;
      if (f) base.faces[f] = { ...(base.faces[f] || {}), ...v };
      else base.geral = { ...(base.geral || {}), ...v };
    });
    return base;
  };

  /* =============================== UI ============================= */

  return (
    <div>
      <style>{`
        @media print {
          .sidebar, .app-header, .no-print { display: none !important; }
          .main-content, .page-content { margin: 0 !important; padding: 0 !important; }
          .card { break-inside: avoid; box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1>Odontograma</h1>
          <p>Mapa dental por dente e por face, com registro clínico do paciente</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pacienteId && (
            <>
              <button className="btn btn-secondary" onClick={abrirHistorico}><History size={15} /> Histórico</button>
              <button className="btn btn-secondary" onClick={imprimir}><Printer size={15} /> Imprimir</button>
            </>
          )}
          {totalPendentes > 0 && (
            <button className="btn btn-primary" onClick={salvarTudo} disabled={salvando}>
              <Save size={15} /> Salvar {totalPendentes} alteração(ões)
            </button>
          )}
        </div>
      </div>

      {/* ------------------ Seleção do paciente ------------------- */}
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, minWidth: 280, flex: 1 }}>
            <label className="form-label">Paciente</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select className="form-control" style={{ paddingLeft: 32 }} value={pacienteId} onChange={trocarPaciente}>
                <option value="">Selecione o paciente</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group no-print" style={{ margin: 0 }}>
            <label className="form-label">Dentição</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${denticao === 'permanente' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDenticao('permanente')}>
                <Smile size={14} /> Permanente
              </button>
              <button className={`btn btn-sm ${denticao === 'deciduo' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDenticao('deciduo')}>
                <Baby size={14} /> Decídua
              </button>
            </div>
          </div>
        </div>

        {/* Dados do paciente */}
        {paciente && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="stat-icon" style={{ background: '#dbeafe20' }}><User size={20} color="var(--primary)" /></div>
              <div>
                <Link to={`/pacientes/${paciente.id}`} style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)', textDecoration: 'none' }}>
                  {paciente.nome}
                </Link>
                <div className="text-xs text-muted">
                  {paciente.dataNascimento ? `${calcularIdade(paciente.dataNascimento)} anos · ` : ''}
                  {paciente.sexo === 'F' ? 'Feminino' : paciente.sexo === 'M' ? 'Masculino' : '—'}
                </div>
              </div>
            </div>
            <div><p className="text-xs text-muted">CPF</p><p className="text-sm font-semibold">{formatCPF(paciente.cpf)}</p></div>
            <div><p className="text-xs text-muted">Telefone</p><p className="text-sm font-semibold">{paciente.telefone || '—'}</p></div>
            <div><p className="text-xs text-muted">Nascimento</p><p className="text-sm font-semibold">{formatDate(paciente.dataNascimento)}</p></div>
            {paciente.responsavel && (
              <div><p className="text-xs text-muted">Responsável</p><p className="text-sm font-semibold">{paciente.responsavel}</p></div>
            )}
            <div><p className="text-xs text-muted">Última atualização</p>
              <p className="text-sm font-semibold">{ultimaAtualizacao ? formatDateTime(ultimaAtualizacao) : 'Sem registros'}</p></div>
          </div>
        )}

        {ficha.alertas && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
            <div><strong style={{ fontSize: 13, color: '#92400e' }}>Alertas clínicos:</strong>
              <span style={{ fontSize: 13, color: '#92400e', marginLeft: 6 }}>{ficha.alertas}</span></div>
          </div>
        )}
      </div>

      {!pacienteId ? (
        <div className="card">
          <div className="empty-state">
            <Smile size={44} />
            <h3>Selecione um paciente</h3>
            <p className="text-sm text-muted">Escolha um paciente acima para visualizar, editar e salvar o odontograma.</p>
          </div>
        </div>
      ) : (
        <>
          {/* --------------------- Legenda --------------------- */}
          <div className="card mb-4">
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>LEGENDA</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {STATUS_DENTE.map((s) => (
                <div key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: s.color, border: `2px solid ${s.border}` }} />
                  <span style={{ fontSize: 12 }}>{s.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">
              Clique no centro do dente para editar o dente inteiro, ou em uma das faces (topo = vestibular, base = lingual, laterais = mesial/distal, centro = oclusal).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }} className="odonto-grid">
            {/* ------------------ Arcada ------------------ */}
            <div className="card" ref={areaImpressao}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <h3 className="card-title">Arcada Dentária — {denticao === 'permanente' ? 'dentição permanente' : 'dentição decídua'}</h3>
                {totalPendentes > 0 && (
                  <span className="badge badge-warning no-print">{totalPendentes} alteração(ões) não salva(s)</span>
                )}
              </div>

              {carregando ? <div className="loading"><div className="spinner" /></div> : (
                <>
                  <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>ARCADA SUPERIOR</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {arcadaSup.map((n) => (
                      <Dente key={n} numero={n} dados={dadosDoDente(n)} mostrarNumeroAcima
                        selecionado={denteSelecionado === n} faceAtiva={faceAtiva}
                        onSelecionar={selecionarDente} onFace={alternarFace} />
                    ))}
                  </div>

                  <div style={{ width: '100%', height: 2, background: 'var(--border)', margin: '18px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {arcadaInf.map((n) => (
                      <Dente key={n} numero={n} dados={dadosDoDente(n)} mostrarNumeroAcima={false}
                        selecionado={denteSelecionado === n} faceAtiva={faceAtiva}
                        onSelecionar={selecionarDente} onFace={alternarFace} />
                    ))}
                  </div>
                  <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 10 }}>ARCADA INFERIOR</p>
                </>
              )}

              {/* Resumo clínico */}
              {resumo.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>RESUMO CLÍNICO</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {resumo.map((r) => (
                      <div key={r.status} style={{ padding: '8px 14px', background: r.color, border: `2px solid ${r.border}`, borderRadius: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>{r.total}</span>
                        <span style={{ fontSize: 12, marginLeft: 6 }}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ------------- Painel de edição ------------- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card no-print" style={{ height: 'fit-content' }}>
                <h3 className="card-title mb-4">
                  {denteSelecionado
                    ? `Dente ${denteSelecionado}${faceAtiva ? ` — face ${FACES.find((f) => f.value === faceAtiva)?.label}` : ''}`
                    : 'Selecione um dente'}
                </h3>

                {denteSelecionado ? (
                  <div>
                    {/* Escolha da face */}
                    <div className="form-group">
                      <label className="form-label">Registrar em</label>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className={`btn btn-sm ${!faceAtiva ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => { setFaceAtiva(null); selecionarDente(denteSelecionado); }}>Dente inteiro</button>
                        {FACES.map((f) => (
                          <button key={f.value} title={f.label}
                            className={`btn btn-sm ${faceAtiva === f.value ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => selecionarFace(f.value)}>{f.value}</button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select className="form-control" value={form.status} onChange={alterarForm('status')}>
                        {STATUS_DENTE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Procedimento</label>
                      <input className="form-control" value={form.procedimento} onChange={alterarForm('procedimento')}
                        placeholder="Ex: Restauração em resina" />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Observações</label>
                      <textarea className="form-control" value={form.observacoes} onChange={alterarForm('observacoes')}
                        placeholder="Anotações clínicas deste dente..." style={{ minHeight: 80 }} />
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                      onClick={salvarDente} disabled={salvando}>
                      <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar dente'}
                    </button>

                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--danger)' }}
                      onClick={limparDente}>
                      <Trash2 size={14} /> Limpar registros do dente {denteSelecionado}
                    </button>
                  </div>
                ) : (
                  <p className="text-muted text-sm">Clique em um dente do mapa para registrar status, procedimento e observações.</p>
                )}
              </div>

              {/* ---------- Ficha clínica do paciente ---------- */}
              <div className="card">
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <h3 className="card-title"><FileText size={15} style={{ verticalAlign: -2 }} /> Dados clínicos do paciente</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Queixa principal</label>
                  <input className="form-control" value={ficha.queixaPrincipal}
                    onChange={(e) => setFicha((f) => ({ ...f, queixaPrincipal: e.target.value }))}
                    placeholder="Motivo da consulta" />
                </div>
                <div className="form-group">
                  <label className="form-label">Anamnese</label>
                  <textarea className="form-control" value={ficha.anamnese}
                    onChange={(e) => setFicha((f) => ({ ...f, anamnese: e.target.value }))}
                    placeholder="Histórico relevante, medicações em uso..." style={{ minHeight: 70 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Alertas</label>
                  <input className="form-control" value={ficha.alertas}
                    onChange={(e) => setFicha((f) => ({ ...f, alertas: e.target.value }))}
                    placeholder="Ex: alergia a anestésico, uso de anticoagulante" />
                </div>
                <div className="form-group">
                  <label className="form-label">Observações gerais</label>
                  <textarea className="form-control" value={ficha.observacoesGerais}
                    onChange={(e) => setFicha((f) => ({ ...f, observacoesGerais: e.target.value }))}
                    style={{ minHeight: 70 }} />
                </div>

                <button className="btn btn-primary no-print" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={salvarFicha} disabled={salvandoFicha}>
                  <Check size={15} /> {salvandoFicha ? 'Salvando...' : 'Salvar dados do paciente'}
                </button>

                <button className="btn btn-ghost btn-sm no-print" style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--danger)' }}
                  onClick={reiniciarOdontograma}>
                  <RotateCcw size={14} /> Reiniciar odontograma
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ------------------------- Histórico ------------------------ */}
      <Modal open={modalHistorico} onClose={() => setModalHistorico(false)} size="lg" title="Histórico do odontograma">
        {historico.length === 0 ? (
          <div className="empty-state"><History size={40} /><h3>Nenhuma alteração registrada</h3></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Data</th><th>Dente</th><th>Face</th><th>De</th><th>Para</th><th>Procedimento</th><th>Responsável</th></tr></thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs">{formatDateTime(h.createdAt)}</td>
                    <td style={{ fontWeight: 600 }}>{h.numeroDente || '—'}</td>
                    <td>{h.face || 'geral'}</td>
                    <td>{infoStatus(h.statusAnterior).label}</td>
                    <td><span className="badge" style={{ background: infoStatus(h.statusNovo).color, border: `1px solid ${infoStatus(h.statusNovo).border}` }}>
                      {infoStatus(h.statusNovo).label}</span></td>
                    <td>{h.procedimento || '—'}</td>
                    <td>{h.usuarioNome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
