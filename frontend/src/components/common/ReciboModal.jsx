import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Printer, MessageCircle, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from './Modal';
import { formatCurrency, dataISO, numeroWhatsApp } from '../../utils/formatters';
import {
  imprimirRecibo, montarHtmlRecibo, textoReciboWhatsApp, valorPorExtenso,
} from '../../utils/recibo';

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'debito_automatico', label: 'Débito Automático' },
  { value: 'parcelado', label: 'Parcelado' },
];

const FORM_VAZIO = {
  pacienteId: '', pagamentoId: '', dentistaId: '', valor: '', descricao: '',
  dataPagamento: dataISO(), formaPagamento: '', pagadorNome: '', pagadorCpf: '',
  pagadorEndereco: '', observacoes: '',
};

/**
 * Emissão de recibo para o paciente.
 *
 * - Com `pagamento`, os campos vêm preenchidos a partir do recebimento lançado.
 * - Sem `pagamento`, funciona como recibo avulso (escolhe-se o paciente).
 * - Com `recibo`, apenas reimprime um recibo já emitido (2ª via).
 */
export default function ReciboModal({
  aberto, onFechar, pagamento = null, recibo = null,
  pacientes = [], dentistas = [], onEmitido,
}) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [empresa, setEmpresa] = useState(null);
  const [emitido, setEmitido] = useState(null);
  const [anteriores, setAnteriores] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [duasVias, setDuasVias] = useState(true);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  /* ------------------------ abertura do modal ----------------------- */

  useEffect(() => {
    if (!aberto) return;

    setEmitido(recibo || null);
    setAnteriores([]);
    api.get('/configuracoes/clinica').then((r) => setEmpresa(r.data)).catch(() => setEmpresa(null));

    if (recibo) return; // 2ª via: não precisa de formulário

    if (pagamento?.id) {
      api.get(`/recibos/pagamento/${pagamento.id}/rascunho`)
        .then((r) => setForm({ ...FORM_VAZIO, ...r.data }))
        .catch(() => setForm({ ...FORM_VAZIO }));
      api.get(`/recibos/pagamento/${pagamento.id}`)
        .then((r) => setAnteriores(r.data.filter((x) => !x.cancelado)))
        .catch(() => {});
    } else if (pacientes.length === 1) {
      // Aberto pela ficha de um paciente: já vem escolhido
      const p = pacientes[0];
      setForm({
        ...FORM_VAZIO,
        pacienteId: String(p.id),
        pagadorNome: p.nome || '',
        pagadorCpf: p.cpf || '',
        pagadorEndereco: [p.endereco, p.cidade && `${p.cidade}/${p.estado || ''}`].filter(Boolean).join(' - '),
      });
    } else {
      setForm({ ...FORM_VAZIO });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, pagamento, recibo]);

  /* Ao escolher o paciente num recibo avulso, já sugere pagador e endereço */
  const escolherPaciente = (e) => {
    const id = e.target.value;
    const p = pacientes.find((x) => String(x.id) === String(id));
    setForm((f) => ({
      ...f,
      pacienteId: id,
      pagadorNome: p?.nome || '',
      pagadorCpf: p?.cpf || '',
      pagadorEndereco: p ? [p.endereco, p.cidade && `${p.cidade}/${p.estado || ''}`].filter(Boolean).join(' - ') : '',
    }));
  };

  const empresaPronta = Boolean(empresa?.razaoSocial);
  const valorNumerico = parseFloat(String(form.valor).replace(',', '.')) || 0;

  const previa = useMemo(
    () => (emitido ? montarHtmlRecibo(emitido, { vias: 1 }) : ''),
    [emitido]
  );

  /* ----------------------------- ações ------------------------------ */

  const emitir = async (e) => {
    e.preventDefault();
    if (!empresaPronta) { toast.error('Cadastre os dados da empresa em Configurações'); return; }
    setSalvando(true);
    try {
      const { data } = await api.post('/recibos', {
        ...form,
        valor: valorNumerico,
        pagamentoId: form.pagamentoId || pagamento?.id || null,
      });
      setEmitido(data);
      toast.success(`Recibo nº ${data.numeroFormatado} emitido`);
      onEmitido?.(data);
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  const enviarWhatsApp = () => {
    const paciente = pacientes.find((p) => String(p.id) === String(emitido.pacienteId));
    const numero = numeroWhatsApp(paciente?.whatsapp || paciente?.telefone || emitido.paciente?.telefone);
    if (!numero) { toast.error('Este paciente não tem WhatsApp válido cadastrado'); return; }
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(textoReciboWhatsApp(emitido))}`, '_blank');
  };

  const fechar = () => { setEmitido(null); setForm(FORM_VAZIO); onFechar(); };

  /* ---------------------------- render ------------------------------ */

  const rodape = emitido ? (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto', fontSize: 13 }}>
        <input type="checkbox" checked={duasVias} onChange={(e) => setDuasVias(e.target.checked)} />
        Imprimir 2 vias (cliente e clínica)
      </label>
      <button className="btn btn-secondary" onClick={enviarWhatsApp}><MessageCircle size={16} /> WhatsApp</button>
      <button className="btn btn-primary" onClick={() => imprimirRecibo(emitido, { vias: duasVias ? 2 : 1 })}>
        <Printer size={16} /> Imprimir / Salvar PDF
      </button>
      <button className="btn btn-secondary" onClick={fechar}>Fechar</button>
    </>
  ) : (
    <>
      <button className="btn btn-secondary" onClick={fechar}>Cancelar</button>
      <button className="btn btn-primary" form="form-recibo" type="submit" disabled={salvando || !empresaPronta}>
        {salvando ? 'Emitindo...' : 'Emitir recibo'}
      </button>
    </>
  );

  return (
    <Modal
      open={aberto}
      onClose={fechar}
      size="lg"
      title={emitido ? `Recibo nº ${emitido.numeroFormatado}` : 'Emitir Recibo'}
      footer={rodape}
    >
      {/* ---------------------- recibo já emitido --------------------- */}
      {emitido ? (
        <div>
          {!recibo && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#ecfdf5', padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>
              <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#065f46' }}>
                Recibo emitido no valor de <strong>{formatCurrency(emitido.valor)}</strong> ({valorPorExtenso(emitido.valor)}).
              </span>
            </div>
          )}
          <iframe
            title="Prévia do recibo"
            srcDoc={previa}
            style={{ width: '100%', height: 430, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
          />
        </div>
      ) : (
        /* ------------------------- formulário ------------------------ */
        <form id="form-recibo" onSubmit={emitir}>
          {!empresaPronta && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fef3c7', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#92400e' }}>
                Os dados da empresa ainda não foram cadastrados — eles formam o cabeçalho do recibo.{' '}
                <Link to="/configuracoes" onClick={fechar} style={{ fontWeight: 600, color: '#92400e' }}>
                  Cadastrar agora
                </Link>
              </span>
            </div>
          )}

          {anteriores.length > 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <FileText size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span className="text-sm text-muted">
                Este recebimento já tem o recibo nº <strong>{anteriores[0].numeroFormatado}</strong>. Emitir outro gera um novo número.
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Paciente <span className="required">*</span></label>
            <select className="form-control" value={form.pacienteId} onChange={escolherPaciente} required disabled={Boolean(pagamento)}>
              <option value="">Selecione</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Valor recebido (R$) <span className="required">*</span></label>
              <input type="number" step="0.01" min="0.01" className="form-control" value={form.valor} onChange={set('valor')} required />
              {valorNumerico > 0 && (
                <p className="text-xs text-muted mt-1" style={{ textTransform: 'capitalize' }}>{valorPorExtenso(valorNumerico)}</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Data do pagamento <span className="required">*</span></label>
              <input type="date" className="form-control" value={form.dataPagamento} onChange={set('dataPagamento')} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Referente a <span className="required">*</span></label>
            <input className="form-control" value={form.descricao} onChange={set('descricao')} required
              placeholder="Ex.: Tratamento ortodôntico — manutenção mensal" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Forma de pagamento</label>
              <select className="form-control" value={form.formaPagamento} onChange={set('formaPagamento')}>
                <option value="">Não informar</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Profissional responsável</label>
              <select className="form-control" value={form.dentistaId} onChange={set('dentistaId')}>
                <option value="">Usar o responsável da clínica</option>
                {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nome}{d.cro ? ` — CRO ${d.cro}` : ''}</option>)}
              </select>
            </div>
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '18px 0 8px' }}>
            Quem pagou
          </p>
          <p className="text-xs text-muted mb-4">
            Normalmente é o próprio paciente. Troque quando quem pagou for o responsável — é esse nome e CPF que valem para o Imposto de Renda.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome do pagador <span className="required">*</span></label>
              <input className="form-control" value={form.pagadorNome} onChange={set('pagadorNome')} required />
            </div>
            <div className="form-group">
              <label className="form-label">CPF do pagador</label>
              <input className="form-control" value={form.pagadorCpf} onChange={set('pagadorCpf')} placeholder="Somente números" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-control" rows={2} value={form.observacoes} onChange={set('observacoes')}
              placeholder="Informação extra que deve aparecer no recibo (opcional)" />
          </div>
        </form>
      )}
    </Modal>
  );
}
