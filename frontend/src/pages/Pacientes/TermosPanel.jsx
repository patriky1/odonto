import { useState, useEffect, useCallback, useRef } from 'react';
import { FileSignature, Plus, Printer, PenLine, Eye, Ban, Trash2, Eraser, FileText, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import AssinaturaCanvas from '../../components/common/AssinaturaCanvas';
import RegistradoPor from '../../components/common/RegistradoPor';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { formatDataHoraBanco, formatCPF } from '../../utils/formatters';
import { imprimirHtml, montarHtmlTermo, croTexto } from '../../utils/impressao';

const STATUS = {
  pendente: { label: 'Aguardando assinatura', className: 'badge-warning' },
  assinado: { label: 'Assinado', className: 'badge-success' },
  revogado: { label: 'Revogado', className: 'badge-danger' },
};

/* ------------------------------------------------------------------ *
 * Criação / edição do termo
 * ------------------------------------------------------------------ */
function TermoForm({ termo, paciente, modelos, dentistas, onSalvar }) {
  const editando = Boolean(termo);
  const [form, setForm] = useState({
    modelo: termo?.modelo || 'geral',
    dentistaId: termo?.dentistaId || '',
    procedimento: termo?.procedimento || '',
    titulo: termo?.titulo || '',
    conteudo: termo?.conteudo || '',
  });
  const [gerando, setGerando] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const gerarTexto = useCallback(async (dados) => {
    setGerando(true);
    try {
      const { data } = await api.post('/termos/previa', {
        modelo: dados.modelo, pacienteId: paciente.id,
        dentistaId: dados.dentistaId || undefined, procedimento: dados.procedimento || undefined,
      });
      setForm((f) => ({ ...f, titulo: data.titulo, conteudo: data.conteudo }));
    } catch { /* toast pelo interceptor */ } finally { setGerando(false); }
  }, [paciente.id]);

  // Novo termo: já traz o texto do modelo padrão preenchido
  useEffect(() => { if (!editando) gerarTexto(form); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const trocarModelo = (e) => {
    const modelo = e.target.value;
    const m = modelos.find((x) => x.id === modelo);
    const novo = { ...form, modelo, procedimento: m?.procedimentoPadrao || '' };
    setForm(novo);
    gerarTexto(novo);
  };

  return (
    <form id="form-termo" onSubmit={(e) => { e.preventDefault(); onSalvar(form); }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="termo-modelo">Modelo</label>
          <select id="termo-modelo" className="form-control" value={form.modelo} onChange={trocarModelo} disabled={editando}>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="termo-dentista">Profissional responsável</label>
          <select id="termo-dentista" className="form-control" value={form.dentistaId} onChange={set('dentistaId')}>
            <option value="">Selecione</option>
            {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="termo-proc">Procedimento</label>
        <input id="termo-proc" className="form-control" value={form.procedimento} onChange={set('procedimento')}
          placeholder="Ex.: Exodontia do dente 38" />
      </div>
      {!editando && (
        <button type="button" className="btn btn-secondary btn-sm mb-4" disabled={gerando} onClick={() => gerarTexto(form)}>
          <FileText size={14} /> {gerando ? 'Preenchendo…' : 'Preencher o texto com estes dados'}
        </button>
      )}
      <div className="form-group">
        <label className="form-label" htmlFor="termo-titulo">Título <span className="required">*</span></label>
        <input id="termo-titulo" className="form-control" value={form.titulo} onChange={set('titulo')} required />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="termo-texto">Texto do termo <span className="required">*</span></label>
        <textarea id="termo-texto" className="form-control" value={form.conteudo} onChange={set('conteudo')} required
          style={{ minHeight: 280, lineHeight: 1.6 }} />
        <p className="text-xs text-muted mt-1">
          O texto pode ser ajustado até a assinatura. Depois de assinado, fica travado. Revise os modelos com o jurídico ou o CRO da clínica.
        </p>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Assinatura
 * ------------------------------------------------------------------ */
function AssinarForm({ termo, paciente, onAssinar, onImprimir }) {
  const quadro = useRef(null);
  const menor = Boolean(paciente.responsavel);
  const [forma, setForma] = useState('digital');
  const [relacao, setRelacao] = useState(menor ? 'responsavel' : 'paciente');
  const [nome, setNome] = useState(menor ? paciente.responsavel : paciente.nome);
  const [documento, setDocumento] = useState(menor ? '' : (paciente.cpf ? formatCPF(paciente.cpf) : ''));
  const [temTraco, setTemTraco] = useState(false);
  const [leu, setLeu] = useState(false);

  const trocarRelacao = (v) => {
    setRelacao(v);
    if (v === 'paciente') { setNome(paciente.nome); setDocumento(paciente.cpf ? formatCPF(paciente.cpf) : ''); }
    else { setNome(paciente.responsavel || ''); setDocumento(''); }
  };

  const enviar = (e) => {
    e.preventDefault();
    if (!leu) { toast.error('Confirme que o termo foi lido e explicado'); return; }
    if (forma === 'digital' && !temTraco) { toast.error('Faça a assinatura no quadro'); return; }
    onAssinar({
      formaAssinatura: forma,
      assinanteNome: nome,
      assinanteDocumento: documento,
      assinanteRelacao: relacao,
      assinaturaImagem: forma === 'digital' ? quadro.current?.imagem() : undefined,
    });
  };

  return (
    <form id="form-assinar" onSubmit={enviar}>
      <p className="text-sm text-muted mb-2">{termo.titulo}</p>
      <div className="termo-texto mb-4" tabIndex={0}>{termo.conteudo}</div>

      <div className="form-group">
        <label className="form-label">Como o termo será assinado?</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={`btn btn-sm ${forma === 'digital' ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={forma === 'digital'} onClick={() => setForma('digital')}>
            <PenLine size={14} /> Na tela (tablet ou celular)
          </button>
          <button type="button" className={`btn btn-sm ${forma === 'papel' ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={forma === 'papel'} onClick={() => setForma('papel')}>
            <Printer size={14} /> No papel
          </button>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="ass-relacao">Quem assina</label>
          <select id="ass-relacao" className="form-control" value={relacao} onChange={(e) => trocarRelacao(e.target.value)}>
            <option value="paciente">O próprio paciente</option>
            <option value="responsavel">Responsável legal</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ass-nome">Nome completo <span className="required">*</span></label>
          <input id="ass-nome" className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ass-doc">CPF / RG</label>
          <input id="ass-doc" className="form-control" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </div>
      </div>

      {forma === 'digital' ? (
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ margin: 0 }}>Assinatura</label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => quadro.current?.limpar()} disabled={!temTraco}>
              <Eraser size={14} /> Limpar
            </button>
          </div>
          <AssinaturaCanvas ref={quadro} onMudar={setTemTraco} />
        </div>
      ) : (
        <div className="card mb-4" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
          <p className="text-sm">
            Imprima o termo, colete a assinatura e guarde a via assinada. Depois confirme aqui para registrar no sistema.
          </p>
          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={onImprimir}>
            <Printer size={14} /> Imprimir para assinar
          </button>
        </div>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={leu} onChange={(e) => setLeu(e.target.checked)} style={{ marginTop: 3 }} />
        O termo foi lido pelo(a) paciente ou lido para ele(a), e as dúvidas foram esclarecidas.
      </label>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Painel
 * ------------------------------------------------------------------ */
export default function TermosPanel({ paciente, dentistas, onAlterado }) {
  const { isAdmin } = useAuth();
  const confirmar = useConfirmacao();
  const [termos, setTermos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [empresa, setEmpresa] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { tipo: 'novo'|'editar'|'assinar'|'ver'|'revogar', termo }
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get(`/termos/paciente/${paciente.id}`)
      .then((r) => { setTermos(r.data); onAlterado?.(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.id]);

  useEffect(() => {
    carregar();
    api.get('/termos/modelos').then((r) => setModelos(r.data)).catch(() => {});
    api.get('/configuracoes/clinica').then((r) => setEmpresa(r.data || {})).catch(() => {});
  }, [carregar]);

  const fechar = () => { setModal(null); setMotivo(''); };
  const imprimir = (termo) => imprimirHtml(montarHtmlTermo(termo, { empresa, paciente }));

  const salvar = async (form) => {
    setSalvando(true);
    try {
      if (modal.tipo === 'editar') {
        await api.put(`/termos/${modal.termo.id}`, form);
        toast.success('Termo atualizado');
        fechar();
      } else {
        const { data } = await api.post('/termos', { ...form, pacienteId: paciente.id });
        toast.success('Termo criado. Agora colete a assinatura.');
        setModal({ tipo: 'assinar', termo: data });
      }
      carregar();
    } catch { /* noop */ } finally { setSalvando(false); }
  };

  const assinar = async (dados) => {
    setSalvando(true);
    try {
      const { data } = await api.patch(`/termos/${modal.termo.id}/assinar`, dados);
      toast.success('Assinatura registrada');
      setModal({ tipo: 'ver', termo: data });
      carregar();
    } catch { /* noop */ } finally { setSalvando(false); }
  };

  const revogar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/termos/${modal.termo.id}/revogar`, { motivo });
      toast.success('Termo revogado');
      fechar();
      carregar();
    } catch { /* noop */ } finally { setSalvando(false); }
  };

  const excluir = async (t) => {
    const ok = await confirmar({
      titulo: 'Excluir termo',
      item: t.titulo,
      mensagem: t.status === 'pendente'
        ? 'O termo ainda não foi assinado e será apagado.'
        : 'Este termo foi assinado. Apagar remove o registro da assinatura do prontuário.',
    });
    if (!ok) return;
    try {
      await api.delete(`/termos/${t.id}`);
      toast.success('Termo excluído');
      carregar();
    } catch { /* noop */ }
  };

  const pendentes = termos.filter((t) => t.status === 'pendente').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <p className="text-sm text-muted" style={{ maxWidth: 560 }}>
          Termos de autorização e consentimento do paciente. Crie a partir de um modelo, colete a assinatura na tela ou no papel e imprima quando precisar.
        </p>
        <button className="btn btn-primary" onClick={() => setModal({ tipo: 'novo' })}><Plus size={16} /> Novo termo</button>
      </div>

      {pendentes > 0 && (
        <div className="filtro-dentista-ativo" style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>
          <FileSignature size={16} /> {pendentes} termo{pendentes > 1 ? 's' : ''} aguardando assinatura.
        </div>
      )}

      {loading ? <div className="loading"><div className="spinner" /></div> : termos.length === 0 ? (
        <div className="empty-state">
          <FileSignature size={40} />
          <h3>Nenhum termo para este paciente</h3>
          <p className="text-sm text-muted">Crie o termo de consentimento antes de iniciar o tratamento.</p>
        </div>
      ) : termos.map((t) => {
        const st = STATUS[t.status] || STATUS.pendente;
        return (
          <div key={t.id} className="termo-item">
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontWeight: 600 }}>{t.titulo}</p>
              <p className="text-sm text-muted">
                {t.procedimento || 'Sem procedimento informado'}
                {t.dentistaNome ? ` — ${t.dentistaNome}` : ''}
              </p>
              <p className="text-xs text-muted mt-1">
                {t.status === 'assinado' && `Assinado por ${t.assinanteNome} em ${formatDataHoraBanco(t.assinadoEm)} (${t.formaAssinatura === 'digital' ? 'na tela' : 'no papel'})`}
                {t.status === 'revogado' && `Revogado em ${formatDataHoraBanco(t.revogadoEm)}${t.motivoRevogacao ? ` — ${t.motivoRevogacao}` : ''}`}
                {t.status === 'pendente' && `Criado em ${formatDataHoraBanco(t.createdAt)}`}
              </p>
              <RegistradoPor registro={t} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <span className={`badge ${st.className}`}>{st.label}</span>
              <div className="actions" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {t.status === 'pendente' && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal({ tipo: 'assinar', termo: t })}>
                    <PenLine size={14} /> Assinar
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setModal({ tipo: 'ver', termo: t })} title="Ver termo"><Eye size={14} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => imprimir(t)} title="Imprimir"><Printer size={14} /></button>
                {t.status === 'pendente' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal({ tipo: 'editar', termo: t })}>Editar</button>
                )}
                {t.status === 'assinado' && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warning)' }} title="Paciente retirou o consentimento"
                    onClick={() => setModal({ tipo: 'revogar', termo: t })}><Ban size={14} /></button>
                )}
                {(t.status === 'pendente' || isAdmin) && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} title="Excluir" onClick={() => excluir(t)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Novo / editar */}
      <Modal open={modal?.tipo === 'novo' || modal?.tipo === 'editar'} onClose={fechar} size="lg"
        title={modal?.tipo === 'editar' ? 'Editar termo' : 'Novo termo de consentimento'}
        footer={<>
          <button className="btn btn-secondary" onClick={fechar}>Cancelar</button>
          <button className="btn btn-primary" form="form-termo" type="submit" disabled={salvando}>
            {modal?.tipo === 'editar' ? 'Salvar alterações' : 'Criar e coletar assinatura'}
          </button>
        </>}>
        {(modal?.tipo === 'novo' || modal?.tipo === 'editar') && (
          <TermoForm termo={modal.termo} paciente={paciente} modelos={modelos} dentistas={dentistas} onSalvar={salvar} />
        )}
      </Modal>

      {/* Assinar */}
      <Modal open={modal?.tipo === 'assinar'} onClose={fechar} size="lg" title="Coletar assinatura"
        footer={<>
          <button className="btn btn-secondary" onClick={fechar}>Assinar depois</button>
          <button className="btn btn-primary" form="form-assinar" type="submit" disabled={salvando}>
            <CheckCircle size={15} /> Confirmar assinatura
          </button>
        </>}>
        {modal?.tipo === 'assinar' && (
          <AssinarForm termo={modal.termo} paciente={paciente} onAssinar={assinar} onImprimir={() => imprimir(modal.termo)} />
        )}
      </Modal>

      {/* Ver */}
      <Modal open={modal?.tipo === 'ver'} onClose={fechar} size="lg" title={modal?.termo?.titulo || 'Termo'}
        footer={<>
          <button className="btn btn-secondary" onClick={fechar}>Fechar</button>
          <button className="btn btn-primary" onClick={() => imprimir(modal.termo)}><Printer size={15} /> Imprimir</button>
        </>}>
        {modal?.tipo === 'ver' && (
          <div>
            <RegistradoPor registro={modal.termo} variante="bloco" />
            <div className="termo-texto mb-4" tabIndex={0}>{modal.termo.conteudo}</div>
            {modal.termo.status !== 'pendente' ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {modal.termo.assinaturaImagem && (
                  <img className="assinatura-imagem" src={modal.termo.assinaturaImagem} alt={`Assinatura de ${modal.termo.assinanteNome}`} />
                )}
                <div className="text-sm">
                  <strong>{modal.termo.assinanteNome}</strong>
                  <div className="text-muted">
                    {modal.termo.assinanteRelacao === 'responsavel' ? 'Responsável legal' : 'Paciente'}
                    {modal.termo.assinanteDocumento ? ` — ${modal.termo.assinanteDocumento}` : ''}
                  </div>
                  <div className="text-muted">
                    {modal.termo.formaAssinatura === 'digital' ? 'Assinado na tela' : 'Assinado no papel'} em {formatDataHoraBanco(modal.termo.assinadoEm)}
                  </div>
                  {modal.termo.dentistaNome && (
                    <div className="text-muted">
                      Profissional: {modal.termo.dentistaNome}{modal.termo.dentistaCro ? ` (${croTexto(modal.termo.dentistaCro)})` : ''}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Este termo ainda não foi assinado.</p>
            )}
          </div>
        )}
      </Modal>

      {/* Revogar */}
      <Modal open={modal?.tipo === 'revogar'} onClose={fechar} title="Revogar termo"
        footer={<>
          <button className="btn btn-secondary" onClick={fechar}>Voltar</button>
          <button className="btn btn-danger" onClick={revogar} disabled={salvando}>Revogar termo</button>
        </>}>
        {modal?.tipo === 'revogar' && (
          <div>
            <p className="text-sm mb-4">
              Use quando o paciente retirar o consentimento para <strong>{modal.termo.procedimento || modal.termo.titulo}</strong>.
              O termo continua no histórico, marcado como revogado.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="rev-motivo">Motivo</label>
              <textarea id="rev-motivo" className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: paciente desistiu do procedimento" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
