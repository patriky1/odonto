import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, DollarSign, TrendingUp, TrendingDown, AlertCircle, Download,
  Repeat, CheckCircle, Wallet, PiggyBank, Receipt, Filter, Search, Lock, Stethoscope,
  Printer, Ban, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell,
} from 'recharts';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useFinanceiro } from '../../contexts/FinanceiroContext';
import { ValorProtegido, BlocoProtegido, BotaoDesbloqueio } from '../../components/common/ValorProtegido';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import { formatCurrency, formatDate, getStatusPagamento, dataISO } from '../../utils/formatters';
import ReciboModal from '../../components/common/ReciboModal';
import LinkPaciente from '../../components/common/LinkPaciente';
import RegistradoPor from '../../components/common/RegistradoPor';
import { imprimirRecibo, rotuloForma } from '../../utils/recibo';

/* ================================================================== *
 * CONSTANTES
 * ================================================================== */

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

const CENTROS_CUSTO = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'clinico', label: 'Clínico' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
];

const FREQUENCIAS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const CORES = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#d97706', '#dc2626', '#059669', '#4f46e5'];

const STATUS_DESPESA = {
  pago: { label: 'Pago', className: 'badge-success' },
  pendente: { label: 'A pagar', className: 'badge-warning' },
  atrasado: { label: 'Atrasado', className: 'badge-danger' },
  cancelado: { label: 'Cancelado', className: 'badge-gray' },
};

const primeiroDiaDoMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const ultimoDiaDoMes = () => {
  const d = new Date();
  return dataISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
// Data local (antes usava UTC, que vira o dia às 21h no Brasil)
const hojeISO = () => dataISO(new Date());
const fmtData = (d) => (d ? String(d).split('T')[0] : '');

/* ================================================================== *
 * FORMULÁRIO — PAGAMENTO DE PACIENTE
 * ================================================================== */

function PagamentoForm({ pagamento, pacientes, dentistas, procedimentos = [], onSubmit, dentistaPadrao = '' }) {
  const [form, setForm] = useState({
    pacienteId: pagamento?.pacienteId || '',
    dentistaId: pagamento?.dentistaId || (pagamento ? '' : dentistaPadrao),
    descricao: pagamento?.descricao || '',
    valor: pagamento?.valor ?? '',
    valorPago: pagamento?.valorPago ?? '',
    dataVencimento: fmtData(pagamento?.dataVencimento),
    dataPagamento: fmtData(pagamento?.dataPagamento),
    formaPagamento: pagamento?.formaPagamento || '',
    parcelas: pagamento?.parcelas || 1,
    status: pagamento?.status || 'pendente',
    observacoes: pagamento?.observacoes || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const saldo = (parseFloat(form.valor) || 0) - (parseFloat(form.valorPago) || 0);
  // Procedimento cadastrado com o mesmo nome da descrição (só como referência de valor)
  const procedimentoEscolhido = procedimentos.find(
    (p) => p.nome.trim().toLowerCase() === String(form.descricao).trim().toLowerCase()
  );

  return (
    <form id="form-pagamento" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-group">
        <label className="form-label">Paciente <span className="required">*</span></label>
        <select className="form-control" value={form.pacienteId} onChange={set('pacienteId')} required>
          <option value="">Selecione</option>
          {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Dentista Responsável</label>
        <select className="form-control" value={form.dentistaId} onChange={set('dentistaId')}>
          <option value="">Selecione o dentista</option>
          {(dentistas || []).map((d) => (
            <option key={d.id} value={d.id}>{d.nome}{d.especialidade ? ` — ${d.especialidade}` : ''}</option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">Profissional responsável pelo atendimento relacionado a este pagamento.</p>
      </div>
      <div className="form-group">
        <label className="form-label">Descrição <span className="required">*</span></label>
        <input className="form-control" value={form.descricao} onChange={set('descricao')} required
          list="lista-procedimentos-pagamento" autoComplete="off"
          placeholder="Escolha um procedimento ou digite livremente" />
        <datalist id="lista-procedimentos-pagamento">
          {procedimentos.map((p) => <option key={p.id} value={p.nome} />)}
        </datalist>
        {procedimentoEscolhido && Number(procedimentoEscolhido.valor) > 0 ? (
          <p className="text-xs text-muted mt-1">
            Valor de referência deste procedimento: <strong>{formatCurrency(procedimentoEscolhido.valor)}</strong>{' '}
            {String(form.valor) !== String(procedimentoEscolhido.valor) && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', color: 'var(--primary)' }}
                onClick={() => setForm((f) => ({ ...f, valor: procedimentoEscolhido.valor }))}>
                usar este valor
              </button>
            )}
          </p>
        ) : (
          <p className="text-xs text-muted mt-1">A lista mostra os procedimentos cadastrados; também é possível escrever outra descrição.</p>
        )}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor Total (R$) <span className="required">*</span></label>
          <input type="number" step="0.01" min="0" className="form-control" value={form.valor} onChange={set('valor')} required placeholder="0,00" />
        </div>
        <div className="form-group">
          <label className="form-label">Valor Pago (R$)</label>
          <input type="number" step="0.01" min="0" className="form-control" value={form.valorPago} onChange={set('valorPago')} placeholder="0,00" />
        </div>
        <div className="form-group">
          <label className="form-label">Vencimento</label>
          <input type="date" className="form-control" value={form.dataVencimento} onChange={set('dataVencimento')} />
        </div>
        <div className="form-group">
          <label className="form-label">Data Pagamento</label>
          <input type="date" className="form-control" value={form.dataPagamento} onChange={set('dataPagamento')} />
        </div>
        <div className="form-group">
          <label className="form-label">Forma de Pagamento</label>
          <select className="form-control" value={form.formaPagamento} onChange={set('formaPagamento')}>
            <option value="">Selecione</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-control" value={form.status} onChange={set('status')}>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      {saldo > 0 && (
        <p className="text-sm" style={{ color: 'var(--warning)', marginBottom: 12 }}>
          Saldo em aberto: <strong>{formatCurrency(saldo)}</strong>
        </p>
      )}
      <div className="form-group">
        <label className="form-label">Observações</label>
        <textarea className="form-control" value={form.observacoes} onChange={set('observacoes')} />
      </div>
    </form>
  );
}

/** Campo "Dentista" dos lançamentos — define em qual filtro de dentista o valor entra. */
function CampoDentista({ value, onChange, dentistas, ajuda }) {
  return (
    <div className="form-group">
      <label className="form-label">Dentista</label>
      <select className="form-control" value={value} onChange={onChange}>
        <option value="">Clínica (sem dentista específico)</option>
        {(dentistas || []).map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
      </select>
      <p className="text-xs text-muted mt-1">{ajuda}</p>
    </div>
  );
}

/* ================================================================== *
 * FORMULÁRIO — DESPESA (GASTO DA EMPRESA)
 * ================================================================== */

function DespesaForm({ despesa, categorias, dentistas, onSubmit, dentistaPadrao = '' }) {
  const [form, setForm] = useState({
    dentistaId: despesa?.dentistaId || (despesa ? '' : dentistaPadrao),
    descricao: despesa?.descricao || '',
    valor: despesa?.valor ?? '',
    data: fmtData(despesa?.data) || hojeISO(),
    categoria: despesa?.categoria || '',
    fornecedor: despesa?.fornecedor || '',
    formaPagamento: despesa?.formaPagamento || '',
    dataVencimento: fmtData(despesa?.dataVencimento),
    status: despesa?.status || 'pago',
    centroCusto: despesa?.centroCusto || '',
    documento: despesa?.documento || '',
    observacoes: despesa?.observacoes || '',
    recorrente: !!despesa?.recorrente,
    frequencia: despesa?.frequencia || 'mensal',
    gerarParcelas: false,
    parcelas: 1,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const check = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  return (
    <form id="form-despesa" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-group">
        <label className="form-label">Descrição do gasto <span className="required">*</span></label>
        <input className="form-control" value={form.descricao} onChange={set('descricao')} required placeholder="Ex: Aluguel do consultório, Compra de resina..." />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor (R$) <span className="required">*</span></label>
          <input type="number" step="0.01" min="0" className="form-control" value={form.valor} onChange={set('valor')} required placeholder="0,00" />
        </div>
        <div className="form-group">
          <label className="form-label">Categoria <span className="required">*</span></label>
          <select className="form-control" value={form.categoria} onChange={set('categoria')} required>
            <option value="">Selecione</option>
            {categorias.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Centro de Custo</label>
          <select className="form-control" value={form.centroCusto} onChange={set('centroCusto')}>
            <option value="">Não definido</option>
            {CENTROS_CUSTO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Fornecedor</label>
          <input className="form-control" value={form.fornecedor} onChange={set('fornecedor')} placeholder="Nome do fornecedor / prestador" />
        </div>
        <div className="form-group">
          <label className="form-label">Nº do documento / NF</label>
          <input className="form-control" value={form.documento} onChange={set('documento')} placeholder="Ex: NF 12345" />
        </div>
      </div>

      <CampoDentista value={form.dentistaId} onChange={set('dentistaId')} dentistas={dentistas}
        ajuda="Gastos ligados a um dentista (laboratório, materiais, comissão) entram no resumo dele quando o filtro de dentista estiver ativo." />

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Data do lançamento <span className="required">*</span></label>
          <input type="date" className="form-control" value={form.data} onChange={set('data')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Vencimento</label>
          <input type="date" className="form-control" value={form.dataVencimento} onChange={set('dataVencimento')} />
        </div>
        <div className="form-group">
          <label className="form-label">Forma de Pagamento</label>
          <select className="form-control" value={form.formaPagamento} onChange={set('formaPagamento')}>
            <option value="">Selecione</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Situação</label>
          <select className="form-control" value={form.status} onChange={set('status')}>
            <option value="pago">Pago</option>
            <option value="pendente">A pagar</option>
            <option value="atrasado">Atrasado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={form.recorrente} onChange={check('recorrente')} />
          <Repeat size={15} /> Despesa fixa / recorrente
        </label>
        {form.recorrente && (
          <div className="form-group" style={{ marginTop: 10, marginBottom: 0, maxWidth: 240 }}>
            <label className="form-label">Frequência</label>
            <select className="form-control" value={form.frequencia} onChange={set('frequencia')}>
              {FREQUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <p className="text-xs text-muted mt-1">
              Use o botão "Gerar recorrentes" na listagem para lançar automaticamente as próximas competências.
            </p>
          </div>
        )}

        {!despesa && !form.recorrente && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, marginTop: 12 }}>
              <input type="checkbox" checked={form.gerarParcelas} onChange={check('gerarParcelas')} />
              Lançar parcelado
            </label>
            {form.gerarParcelas && (
              <div className="form-group" style={{ marginTop: 10, marginBottom: 0, maxWidth: 180 }}>
                <label className="form-label">Nº de parcelas</label>
                <input type="number" min="2" max="60" className="form-control" value={form.parcelas} onChange={set('parcelas')} />
                <p className="text-xs text-muted mt-1">O valor total será dividido entre as parcelas mensais.</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Observações</label>
        <textarea className="form-control" value={form.observacoes} onChange={set('observacoes')} placeholder="Detalhes do gasto..." />
      </div>
    </form>
  );
}

/* ================================================================== *
 * FORMULÁRIO — RECEITA AVULSA
 * ================================================================== */

function ReceitaForm({ receita, categorias, dentistas, onSubmit, dentistaPadrao = '' }) {
  const [form, setForm] = useState({
    dentistaId: receita?.dentistaId || (receita ? '' : dentistaPadrao),
    descricao: receita?.descricao || '',
    valor: receita?.valor ?? '',
    data: fmtData(receita?.data) || hojeISO(),
    categoria: receita?.categoria || '',
    formaPagamento: receita?.formaPagamento || '',
    origem: receita?.origem || '',
    observacoes: receita?.observacoes || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form id="form-receita" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-group">
        <label className="form-label">Descrição <span className="required">*</span></label>
        <input className="form-control" value={form.descricao} onChange={set('descricao')} required placeholder="Ex: Convênio odontológico, venda de produto..." />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor (R$) <span className="required">*</span></label>
          <input type="number" step="0.01" min="0" className="form-control" value={form.valor} onChange={set('valor')} required placeholder="0,00" />
        </div>
        <div className="form-group">
          <label className="form-label">Data <span className="required">*</span></label>
          <input type="date" className="form-control" value={form.data} onChange={set('data')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-control" value={form.categoria} onChange={set('categoria')}>
            <option value="">Selecione</option>
            {categorias.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Forma de Recebimento</label>
          <select className="form-control" value={form.formaPagamento} onChange={set('formaPagamento')}>
            <option value="">Selecione</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Origem / Pagador</label>
        <input className="form-control" value={form.origem} onChange={set('origem')} placeholder="Ex: Unimed Odonto" />
      </div>
      <CampoDentista value={form.dentistaId} onChange={set('dentistaId')} dentistas={dentistas}
        ajuda="Receitas atribuídas a um dentista entram no resumo dele quando o filtro de dentista estiver ativo." />
      <div className="form-group">
        <label className="form-label">Observações</label>
        <textarea className="form-control" value={form.observacoes} onChange={set('observacoes')} />
      </div>
    </form>
  );
}

/* ================================================================== *
 * CARTÃO DE INDICADOR
 * ================================================================== */

function StatCard({ label, valor, extra, cor, Icone, fundo, protegido = true }) {
  const conteudo = (
    <>
      <p className="stat-value" style={{ color: cor }}>{valor}</p>
      {extra && <p className="text-sm text-muted">{extra}</p>}
    </>
  );
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          {protegido ? <ValorProtegido marcador="•••••">{conteudo}</ValorProtegido> : conteudo}
        </div>
        <div className="stat-icon" style={{ background: fundo }}><Icone size={22} color={cor} /></div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * PÁGINA
 * ================================================================== */

export default function FinanceiroPage() {
  const { usuario } = useAuth();
  const confirmar = useConfirmacao();
  const { liberado, carregarStatus } = useFinanceiro();
  const [modalSenha, setModalSenha] = useState(false);
  const podeGerenciar = ['admin', 'dentista'].includes(usuario?.perfil);

  const [aba, setAba] = useState('pagamentos');
  const [periodo, setPeriodo] = useState({ inicio: primeiroDiaDoMes(), fim: ultimoDiaDoMes() });

  const [pagamentos, setPagamentos] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [categorias, setCategorias] = useState({ despesas: [], receitas: [] });
  const [pacientes, setPacientes] = useState([]);
  const [dentistas, setDentistas] = useState([]);
  const [procedimentos, setProcedimentos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'pagamento' | 'despesa' | 'receita'
  const [editando, setEditando] = useState(null);

  // Recibos entregues ao paciente
  const [recibos, setRecibos] = useState([]);
  const [loadingRecibos, setLoadingRecibos] = useState(false);
  const [reciboModal, setReciboModal] = useState(null); // { pagamento } | { recibo } | {}

  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroDentista, setFiltroDentista] = useState('');

  /* ------------------------- carregamento ------------------------- */

  const carregar = useCallback(() => {
    setLoading(true);
    // O filtro de dentista vale para tudo: listas, resumo, relatório e recibos
    const p = { inicio: periodo.inicio, fim: periodo.fim, dentistaId: filtroDentista || undefined };
    Promise.all([
      api.get('/financeiro/pagamentos', { params: { ...p, status: filtroStatus || undefined, busca: busca || undefined } }),
      api.get('/financeiro/despesas', { params: { ...p, status: filtroStatus || undefined, categoria: filtroCategoria || undefined, busca: busca || undefined } }),
      api.get('/financeiro/receitas', { params: { ...p, categoria: filtroCategoria || undefined, busca: busca || undefined } }),
      api.get('/financeiro/relatorio', { params: p }),
    ])
      .then(([r1, r2, r3, r4]) => {
        setPagamentos(r1.data);
        setDespesas(r2.data);
        setReceitas(r3.data);
        setRelatorio(r4.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periodo, filtroStatus, filtroCategoria, busca, filtroDentista]);

  useEffect(() => { carregar(); }, [carregar]);

  /** Recibos do período (aba própria e 2ª via). */
  const carregarRecibos = useCallback(() => {
    setLoadingRecibos(true);
    api.get('/recibos', {
      params: {
        inicio: periodo.inicio, fim: periodo.fim,
        busca: busca || undefined, incluirCancelados: true,
        dentistaId: filtroDentista || undefined,
      },
    })
      .then((r) => setRecibos(r.data))
      .catch(() => {})
      .finally(() => setLoadingRecibos(false));
  }, [periodo, busca, filtroDentista]);

  useEffect(() => { if (aba === 'recibos') carregarRecibos(); }, [aba, carregarRecibos]);


  useEffect(() => {
    api.get('/pacientes', { params: { limite: 500 } }).then((r) => setPacientes(r.data.pacientes)).catch(() => {});
    api.get('/dentistas').then((r) => setDentistas(r.data)).catch(() => {});
    api.get('/procedimentos').then((r) => setProcedimentos(r.data)).catch(() => {});
    api.get('/financeiro/categorias').then((r) => setCategorias(r.data)).catch(() => {});
    carregarStatus();
  }, [carregarStatus]);

  // Limpa filtros específicos ao trocar de aba (o dentista e o período continuam valendo)
  useEffect(() => { setFiltroStatus(''); setFiltroCategoria(''); setBusca(''); }, [aba]);

  const dentistaSelecionado = dentistas.find((d) => String(d.id) === String(filtroDentista)) || null;

  /* ---------------------------- ações ----------------------------- */

  const fechar = () => { setModal(null); setEditando(null); };

  /** Recibo não se apaga: cancela-se, e o número usado continua registrado. */
  const cancelarRecibo = async (r) => {
    const ok = await confirmar({
      titulo: 'Cancelar recibo',
      item: `Recibo nº ${r.numeroFormatado} — ${r.pagadorNome}`,
      mensagem: 'O recibo deixa de valer, mas continua na lista com o número usado, para não abrir buraco na numeração.',
      aviso: 'Se o paciente já recebeu a via impressa, peça a devolução ou avise sobre o cancelamento.',
      palavra: 'CANCELAR',
      textoBotao: 'Cancelar recibo',
    });
    if (!ok) return;
    try {
      await api.patch(`/recibos/${r.id}/cancelar`);
      toast.success('Recibo cancelado');
      carregarRecibos();
    } catch { /* noop */ }
  };

  const salvarPagamento = async (data) => {
    try {
      if (editando) await api.put(`/financeiro/pagamentos/${editando.id}`, data);
      else await api.post('/financeiro/pagamentos', data);
      toast.success(editando ? 'Pagamento atualizado!' : 'Pagamento registrado!');
      fechar(); carregar();
    } catch { /* toast já exibido pelo interceptor */ }
  };

  const salvarDespesa = async (data) => {
    try {
      if (editando) await api.put(`/financeiro/despesas/${editando.id}`, data);
      else await api.post('/financeiro/despesas', data);
      toast.success(editando ? 'Gasto atualizado!' : 'Gasto lançado!');
      fechar(); carregar();
    } catch { /* noop */ }
  };

  const salvarReceita = async (data) => {
    try {
      if (editando) await api.put(`/financeiro/receitas/${editando.id}`, data);
      else await api.post('/financeiro/receitas', data);
      toast.success(editando ? 'Receita atualizada!' : 'Receita lançada!');
      fechar(); carregar();
    } catch { /* noop */ }
  };

  const excluir = async (tipo, id, rotulo, item) => {
    const ok = await confirmar({ titulo: `Excluir ${rotulo}`, item, mensagem: 'O lançamento sai dos relatórios e do resultado do período.' });
    if (!ok) return;
    try {
      await api.delete(`/financeiro/${tipo}/${id}`);
      toast.success('Excluído com sucesso');
      carregar();
    } catch { /* noop */ }
  };

  const baixar = async (tipo, id) => {
    try {
      await api.patch(`/financeiro/${tipo}/${id}/${tipo === 'despesas' ? 'pagar' : 'receber'}`);
      toast.success(tipo === 'despesas' ? 'Gasto marcado como pago' : 'Pagamento recebido');
      carregar();
    } catch { /* noop */ }
  };

  const gerarRecorrentes = async () => {
    try {
      const { data } = await api.post('/financeiro/despesas/gerar-recorrentes', { mes: periodo.inicio.substring(0, 7) });
      toast.success(data.mensagem);
      carregar();
    } catch { /* noop */ }
  };

  const exportarCSV = async () => {
    if (!liberado) {
      toast.error('Informe a senha financeira para exportar o relatório');
      setModalSenha(true);
      return;
    }
    try {
      const resp = await api.get('/financeiro/exportar', {
        params: { ...periodo, dentistaId: filtroDentista || undefined }, responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      const sufixo = dentistaSelecionado
        ? `_${dentistaSelecionado.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
        : '';
      a.download = `financeiro_${periodo.inicio}_a_${periodo.fim}${sufixo}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success('Relatório exportado!');
    } catch { /* noop */ }
  };

  /* --------------------------- derivados -------------------------- */

  const totalDespesasLista = useMemo(
    () => despesas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0),
    [despesas]
  );
  const totalReceitasLista = useMemo(
    () => receitas.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0),
    [receitas]
  );

  const dadosPizza = useMemo(
    () => (relatorio?.porCategoria || []).slice(0, 8).map((c) => ({ name: c.label, value: c.total })),
    [relatorio]
  );

  const atalhosPeriodo = [
    { label: 'Este mês', get: () => ({ inicio: primeiroDiaDoMes(), fim: ultimoDiaDoMes() }) },
    {
      label: 'Mês passado',
      get: () => {
        const d = new Date();
        const ini = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const fim = new Date(d.getFullYear(), d.getMonth(), 0);
        return { inicio: dataISO(ini), fim: dataISO(fim) };
      },
    },
    {
      label: 'Últimos 90 dias',
      get: () => {
        const fim = new Date();
        const ini = new Date(); ini.setDate(ini.getDate() - 90);
        return { inicio: dataISO(ini), fim: dataISO(fim) };
      },
    },
    {
      label: 'Este ano',
      get: () => {
        const ano = new Date().getFullYear();
        return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
      },
    },
  ];

  const ABAS = [
    { id: 'pagamentos', label: 'Recebimentos' },
    { id: 'despesas', label: 'Gastos da Empresa' },
    { id: 'receitas', label: 'Outras Receitas' },
    { id: 'recibos', label: 'Recibos' },
    { id: 'relatorio', label: 'Relatório / DRE' },
  ];

  const botaoNovo = {
    pagamentos: { label: 'Novo Pagamento', acao: () => { setEditando(null); setModal('pagamento'); } },
    despesas: { label: 'Novo Gasto', acao: () => { setEditando(null); setModal('despesa'); } },
    receitas: { label: 'Nova Receita', acao: () => { setEditando(null); setModal('receita'); } },
    recibos: { label: 'Emitir Recibo', acao: () => setReciboModal({}) },
    relatorio: null,
  }[aba];

  return (
    <div>
      <div className="page-header">
        <div><h1>Financeiro</h1><p>Recebimentos, gastos da empresa e resultado do consultório</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <BotaoDesbloqueio aberto={modalSenha} onAbrir={() => setModalSenha(true)} onFechar={() => setModalSenha(false)} />
          <button className="btn btn-secondary" onClick={exportarCSV}><Download size={16} /> Exportar CSV</button>
          {botaoNovo && (aba !== 'despesas' || podeGerenciar) && (
            <button className="btn btn-primary" onClick={botaoNovo.acao}><Plus size={16} /> {botaoNovo.label}</button>
          )}
        </div>
      </div>

      {!liberado && (
        <div className="card mb-4" style={{ borderLeft: '4px solid var(--primary)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Lock size={20} color="var(--primary)" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong style={{ fontSize: 14 }}>Valores ocultos</strong>
            <p className="text-sm text-muted">
              Faturamento, gastos e resultado da clínica só aparecem após informar a senha financeira.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModalSenha(true)}>Informar senha</button>
        </div>
      )}

      {/* ------------------------- Período ------------------------- */}
      <div className="card mb-4">
        <div className="filtros-periodo" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">De</label>
            <input type="date" className="form-control" value={periodo.inicio}
              onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Até</label>
            <input type="date" className="form-control" value={periodo.fim}
              onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
            <label className="form-label">Dentista</label>
            <select className="form-control" value={filtroDentista} onChange={(e) => setFiltroDentista(e.target.value)}
              aria-label="Filtrar o financeiro por dentista">
              <option value="">Todos os dentistas</option>
              {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 2 }}>
            {atalhosPeriodo.map((a) => (
              <button key={a.label} className="btn btn-ghost btn-sm" onClick={() => setPeriodo(a.get())}>{a.label}</button>
            ))}
          </div>
        </div>
      </div>

      {dentistaSelecionado && (
        <div className="filtro-dentista-ativo" role="status">
          <Stethoscope size={16} />
          <span style={{ flex: 1, minWidth: 200 }}>
            Mostrando apenas os lançamentos de <strong>{dentistaSelecionado.nome}</strong>: recebimentos, receitas e gastos
            atribuídos a ele(a). Gastos gerais da clínica ficam de fora deste resumo.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setFiltroDentista('')}><X size={14} /> Ver todos</button>
        </div>
      )}

      {/* ------------------------- Resumo -------------------------- */}
      {relatorio && (
        <div className="grid-4 mb-4">
          <StatCard label="Entradas do período" valor={formatCurrency(relatorio.entradas)}
            extra={`Recebimentos ${formatCurrency(relatorio.totalRecebido)}`}
            cor="var(--success)" fundo="#d1fae520" Icone={TrendingUp} />
          <StatCard label="Gastos do período" valor={formatCurrency(relatorio.totalDespesas)}
            extra={`${formatCurrency(relatorio.despesasAPagar)} em aberto`}
            cor="var(--danger)" fundo="#fee2e220" Icone={TrendingDown} />
          <StatCard label="Resultado (lucro)" valor={formatCurrency(relatorio.lucro)}
            extra={`Margem de ${relatorio.margem.toFixed(1)}%`}
            cor={relatorio.lucro >= 0 ? 'var(--success)' : 'var(--danger)'} fundo="#dbeafe20" Icone={DollarSign} />
          <StatCard label="A receber" valor={formatCurrency(relatorio.aReceber)}
            extra={`${relatorio.pagamentosAtrasados} atrasado(s) · ${relatorio.despesasAtrasadas} gasto(s) vencido(s)`}
            cor="var(--warning)" fundo="#fef3c720" Icone={AlertCircle} />
        </div>
      )}

      {/* -------------------------- Abas --------------------------- */}
      <div className="tabs">
        {ABAS.map((t) => (
          <button key={t.id} className={`tab ${aba === t.id ? 'active' : ''}`} onClick={() => setAba(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ===================== ABA: RECEBIMENTOS ==================== */}
      {aba === 'pagamentos' && (
        <div className="card">
          <div className="search-bar" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar por paciente ou descrição..."
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select className="form-control" style={{ maxWidth: 200 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table className="table table-cards">
                <thead>
                  <tr><th>Paciente</th><th>Dentista</th><th>Descrição</th><th>Valor</th><th>Pago</th><th>Saldo</th><th>Vencimento</th><th>Pago em</th><th>Forma</th><th>Status</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {pagamentos.map((p) => {
                    const st = getStatusPagamento(p.status);
                    return (
                      <tr key={p.id}>
                        <td className="td-titulo" style={{ fontWeight: 600 }}>
                          <LinkPaciente id={p.pacienteId} nome={p.paciente?.nome} />
                          <RegistradoPor registro={p} />
                        </td>
                        <td data-label="Dentista" className="text-sm">
                          {p.dentistaNome
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Stethoscope size={13} /> {p.dentistaNome}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td data-label="Descrição">{p.descricao}</td>
                        <td data-label="Valor"><ValorProtegido>{formatCurrency(p.valor)}</ValorProtegido></td>
                        <td data-label="Pago"><ValorProtegido>{formatCurrency(p.valorPago)}</ValorProtegido></td>
                        <td data-label="Saldo" style={{ color: p.saldo > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          <ValorProtegido>{formatCurrency(p.saldo)}</ValorProtegido>
                        </td>
                        <td data-label="Vencimento">{formatDate(p.dataVencimento)}</td>
                        <td data-label="Pago em" style={{ color: p.dataPagamento ? 'var(--success)' : undefined, whiteSpace: 'nowrap' }}>
                          {p.dataPagamento ? formatDate(String(p.dataPagamento).split('T')[0]) : '—'}
                        </td>
                        <td data-label="Forma" style={{ textTransform: 'capitalize' }}>{p.formaPagamento?.replace(/_/g, ' ') || '—'}</td>
                        <td data-label="Status"><span className={`badge ${st.className}`}>{st.label}</span></td>
                        <td className="td-acoes">
                          <div className="actions">
                            {p.status !== 'pago' && (
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} title="Marcar como recebido"
                                onClick={() => baixar('pagamentos', p.id)}><CheckCircle size={14} /></button>
                            )}
                            <button className="btn btn-ghost btn-sm" title="Emitir recibo para o paciente"
                              onClick={() => setReciboModal({ pagamento: p })}><Receipt size={14} /></button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(p); setModal('pagamento'); }}>Editar</button>
                            {podeGerenciar && (
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                onClick={() => excluir('pagamentos', p.id, 'pagamento', `${p.paciente?.nome || ''} — ${p.descricao}`)}>Excluir</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagamentos.length === 0 && (
                    <tr><td colSpan={11}><div className="empty-state"><DollarSign size={40} /><h3>Nenhum pagamento no período</h3></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================== ABA: GASTOS DA EMPRESA ================== */}
      {aba === 'despesas' && (
        <>
          {relatorio?.porGrupo?.length > 0 && (
            <div className="card mb-4">
              <h3 className="card-title mb-4">Composição dos gastos no período</h3>
              <BlocoProtegido altura={120} onDesbloquear={() => setModalSenha(true)}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {relatorio.porGrupo.map((g, i) => (
                  <div key={g.grupo} style={{ flex: '1 1 150px', padding: 14, background: 'var(--bg)', borderRadius: 10, borderLeft: `4px solid ${CORES[i % CORES.length]}` }}>
                    <p className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>{g.grupo.replace('_', ' ')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700 }}>{formatCurrency(g.total)}</p>
                    <p className="text-xs text-muted">
                      {relatorio.totalDespesas > 0 ? ((g.total / relatorio.totalDespesas) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                ))}
              </div>
              </BlocoProtegido>
            </div>
          )}

          <div className="card">
            <div className="search-bar" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar por descrição, fornecedor ou NF..."
                  value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <select className="form-control" style={{ maxWidth: 220 }} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categorias.despesas.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select className="form-control" style={{ maxWidth: 170 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="">Todas as situações</option>
                <option value="pago">Pago</option>
                <option value="pendente">A pagar</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
              {podeGerenciar && (
                <button className="btn btn-secondary btn-sm" onClick={gerarRecorrentes} title="Lançar as despesas fixas deste mês">
                  <Repeat size={14} /> Gerar recorrentes
                </button>
              )}
            </div>

            {loading ? <div className="loading"><div className="spinner" /></div> : (
              <div className="table-wrapper">
                <table className="table table-cards">
                  <thead>
                    <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th>Centro de Custo</th><th>Vencimento</th><th>Situação</th><th style={{ textAlign: 'right' }}>Valor</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {despesas.map((d) => {
                      const cat = categorias.despesas.find((c) => c.value === d.categoria);
                      const st = STATUS_DESPESA[d.status] || STATUS_DESPESA.pago;
                      return (
                        <tr key={d.id}>
                          <td data-label="Data">{formatDate(String(d.data).split('T')[0])}</td>
                          <td className="td-titulo" style={{ fontWeight: 600 }}>
                            {d.descricao}
                            {d.recorrente && <span className="badge badge-info" style={{ marginLeft: 6 }}><Repeat size={10} /> fixa</span>}
                            {d.documento && <div className="text-xs text-muted">{d.documento}</div>}
                            {d.dentistaNome && (
                              <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 400 }}>
                                <Stethoscope size={11} /> {d.dentistaNome}
                              </div>
                            )}
                            <RegistradoPor registro={d} />
                          </td>
                          <td data-label="Categoria">{cat?.label || d.categoria || '—'}</td>
                          <td data-label="Fornecedor">{d.fornecedor || '—'}</td>
                          <td data-label="Centro de custo" style={{ textTransform: 'capitalize' }}>{d.centroCusto || '—'}</td>
                          <td data-label="Vencimento">{formatDate(d.dataVencimento)}</td>
                          <td data-label="Situação"><span className={`badge ${st.className}`}>{st.label}</span></td>
                          <td data-label="Valor" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                            <ValorProtegido>{formatCurrency(d.valor)}</ValorProtegido>
                          </td>
                          <td className="td-acoes">
                            <div className="actions">
                              {podeGerenciar && d.status !== 'pago' && (
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} title="Marcar como pago"
                                  onClick={() => baixar('despesas', d.id)}><CheckCircle size={14} /></button>
                              )}
                              {podeGerenciar && (
                                <>
                                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(d); setModal('despesa'); }}>Editar</button>
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                    onClick={() => excluir('despesas', d.id, 'gasto', d.descricao)}>Excluir</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {despesas.length === 0 && (
                      <tr><td colSpan={9}><div className="empty-state"><Receipt size={40} /><h3>Nenhum gasto lançado no período</h3>
                        <p className="text-sm text-muted">Registre aluguel, materiais, salários e demais custos do consultório.</p></div></td></tr>
                    )}
                  </tbody>
                  {despesas.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600 }}>Total listado</td>
                        <td data-label="Total" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                          <ValorProtegido>{formatCurrency(totalDespesasLista)}</ValorProtegido>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ================== ABA: OUTRAS RECEITAS =================== */}
      {aba === 'receitas' && (
        <div className="card">
          <div className="search-bar" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar receita..."
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select className="form-control" style={{ maxWidth: 220 }} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.receitas.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table className="table table-cards">
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Origem</th><th>Forma</th><th style={{ textAlign: 'right' }}>Valor</th><th>Ações</th></tr></thead>
                <tbody>
                  {receitas.map((r) => {
                    const cat = categorias.receitas.find((c) => c.value === r.categoria);
                    return (
                      <tr key={r.id}>
                        <td data-label="Data">{formatDate(String(r.data).split('T')[0])}</td>
                        <td className="td-titulo" style={{ fontWeight: 600 }}>
                          {r.descricao}
                          {r.dentistaNome && (
                            <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 400 }}>
                              <Stethoscope size={11} /> {r.dentistaNome}
                            </div>
                          )}
                          <RegistradoPor registro={r} />
                        </td>
                        <td data-label="Categoria">{cat?.label || r.categoria || '—'}</td>
                        <td data-label="Origem">{r.origem || '—'}</td>
                        <td data-label="Forma" style={{ textTransform: 'capitalize' }}>{r.formaPagamento?.replace(/_/g, ' ') || '—'}</td>
                        <td data-label="Valor" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                          <ValorProtegido>{formatCurrency(r.valor)}</ValorProtegido>
                        </td>
                        <td className="td-acoes">
                          <div className="actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(r); setModal('receita'); }}>Editar</button>
                            {podeGerenciar && (
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                onClick={() => excluir('receitas', r.id, 'receita', r.descricao)}>Excluir</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {receitas.length === 0 && (
                    <tr><td colSpan={7}><div className="empty-state"><PiggyBank size={40} /><h3>Nenhuma receita avulsa no período</h3></div></td></tr>
                  )}
                </tbody>
                {receitas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Total listado</td>
                      <td data-label="Total" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        <ValorProtegido>{formatCurrency(totalReceitasLista)}</ValorProtegido>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== ABA: RELATÓRIO ======================= */}
      {/* ======================== ABA: RECIBOS ===================== */}
      {aba === 'recibos' && (
        <div className="card">
          <div className="search-bar" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar por paciente, pagador ou descrição..."
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          {loadingRecibos ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table className="table table-cards">
                <thead>
                  <tr><th>Nº</th><th>Emissão</th><th>Pagador</th><th>Referente a</th><th>Valor</th><th>Pagamento</th><th>Forma</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {recibos.map((r) => (
                    <tr key={r.id} style={r.cancelado ? { opacity: .6 } : undefined}>
                      <td className="td-titulo" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {r.numeroFormatado}
                        {r.cancelado && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Cancelado</span>}
                      </td>
                      <td data-label="Emissão">{formatDate(String(r.dataEmissao).split('T')[0])}</td>
                      <td data-label="Pagador">
                        {r.paciente?.nome && r.paciente.nome !== r.pagadorNome ? (
                          <>
                            {r.pagadorNome}
                            <span className="text-xs text-muted" style={{ display: 'block' }}>
                              Paciente: <LinkPaciente id={r.pacienteId} nome={r.paciente.nome} />
                            </span>
                          </>
                        ) : (
                          <LinkPaciente id={r.pacienteId} nome={r.pagadorNome} />
                        )}
                      </td>
                      <td data-label="Referente a">{r.descricao}</td>
                      <td data-label="Valor" style={{ fontWeight: 600 }}>{formatCurrency(r.valor)}</td>
                      <td data-label="Pagamento">{formatDate(r.dataPagamento)}</td>
                      <td data-label="Forma">{rotuloForma(r.formaPagamento) || '—'}</td>
                      <td className="td-acoes">
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm" title="Imprimir 2ª via"
                            onClick={() => imprimirRecibo(r, { vias: 2 })}><Printer size={14} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setReciboModal({ recibo: r })}>Ver</button>
                          {podeGerenciar && !r.cancelado && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} title="Cancelar recibo"
                              onClick={() => cancelarRecibo(r)}><Ban size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {recibos.length === 0 && (
                    <tr><td colSpan={8}><div className="empty-state"><Receipt size={40} /><h3>Nenhum recibo emitido no período</h3>
                      <p className="text-sm text-muted">Emita pelo botão acima ou direto na lista de recebimentos.</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === 'relatorio' && relatorio && !liberado && (
        <div className="card">
          <BlocoProtegido altura={280} onDesbloquear={() => setModalSenha(true)} />
        </div>
      )}

      {aba === 'relatorio' && relatorio && liberado && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card">
            <h3 className="card-title mb-4">
              Demonstrativo do período{relatorio.dentista ? ` — ${relatorio.dentista.nome}` : ''}
            </h3>
            <div className="table-wrapper">
              <table className="table" style={{ minWidth: 0 }}>
                <tbody>
                  <tr><td>Recebimentos de pacientes</td><td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(relatorio.totalRecebido)}</td></tr>
                  <tr><td>Outras receitas</td><td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(relatorio.totalReceitas)}</td></tr>
                  <tr style={{ fontWeight: 700 }}><td>(=) Total de entradas</td><td style={{ textAlign: 'right' }}>{formatCurrency(relatorio.entradas)}</td></tr>
                  <tr><td>(−) Gastos da empresa</td><td style={{ textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(relatorio.totalDespesas)}</td></tr>
                  <tr style={{ fontWeight: 700, fontSize: 16 }}>
                    <td>(=) Resultado do período</td>
                    <td style={{ textAlign: 'right', color: relatorio.lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(relatorio.lucro)}</td>
                  </tr>
                  <tr><td className="text-muted">Margem de lucro</td><td style={{ textAlign: 'right' }} className="text-muted">{relatorio.margem.toFixed(1)}%</td></tr>
                  <tr><td className="text-muted">A receber (em aberto)</td><td style={{ textAlign: 'right' }} className="text-muted">{formatCurrency(relatorio.aReceber)}</td></tr>
                  <tr><td className="text-muted">Contas a pagar (em aberto)</td><td style={{ textAlign: 'right' }} className="text-muted">{formatCurrency(relatorio.despesasAPagar)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title mb-4">Entradas x Gastos — últimos 6 meses</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={relatorio.evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="receitas" name="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Resultado" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div className="card">
              <h3 className="card-title mb-4">Gastos por categoria</h3>
              {dadosPizza.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={dadosPizza} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={false}>
                        {dadosPizza.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="table-wrapper" style={{ marginTop: 8 }}>
                    <table className="table" style={{ minWidth: 0 }}>
                      <thead><tr><th>Categoria</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
                      <tbody>
                        {relatorio.porCategoria.map((c, i) => (
                          <tr key={c.categoria}>
                            <td>
                              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: CORES[i % CORES.length], marginRight: 8 }} />
                              {c.label}
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(c.total)}</td>
                            <td style={{ textAlign: 'right' }}>{c.percentual.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <div className="empty-state"><Filter size={36} /><p>Sem gastos no período</p></div>}
            </div>

            <div className="card">
              <h3 className="card-title mb-4">Recebimentos por forma de pagamento</h3>
              {relatorio.porFormaPagamento.length > 0 ? (
                <div className="table-wrapper">
                  <table className="table" style={{ minWidth: 0 }}>
                    <thead><tr><th>Forma</th><th style={{ textAlign: 'right' }}>Qtd</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                    <tbody>
                      {relatorio.porFormaPagamento.map((f) => (
                        <tr key={f.forma}>
                          <td style={{ textTransform: 'capitalize' }}>{f.forma.replace(/_/g, ' ')}</td>
                          <td style={{ textAlign: 'right' }}>{f.qtd}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(f.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty-state"><Wallet size={36} /><p>Sem recebimentos no período</p></div>}

              {relatorio.porDentista?.length > 0 && (
                <>
                  <h3 className="card-title mb-2" style={{ marginTop: 24 }}>Produção por dentista</h3>
                  <div className="table-wrapper">
                    <table className="table" style={{ minWidth: 0 }}>
                      <thead><tr><th>Dentista</th><th style={{ textAlign: 'right' }}>Atendimentos</th><th style={{ textAlign: 'right' }}>Total recebido</th></tr></thead>
                      <tbody>
                        {relatorio.porDentista.map((d) => (
                          <tr key={d.dentista}>
                            <td>{d.dentista}</td>
                            <td style={{ textAlign: 'right' }}>{d.qtd}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {relatorio.maioresFornecedores.length > 0 && (
                <>
                  <h3 className="card-title mb-2" style={{ marginTop: 24 }}>Maiores fornecedores</h3>
                  <div className="table-wrapper">
                    <table className="table" style={{ minWidth: 0 }}>
                      <thead><tr><th>Fornecedor</th><th style={{ textAlign: 'right' }}>Lançamentos</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                      <tbody>
                        {relatorio.maioresFornecedores.map((f) => (
                          <tr key={f.fornecedor}>
                            <td>{f.fornecedor}</td>
                            <td style={{ textAlign: 'right' }}>{f.qtd}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(f.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------- Modais ------------------------- */}
      <Modal open={modal === 'pagamento'} onClose={fechar} size="lg"
        title={editando ? 'Editar Pagamento' : 'Novo Pagamento'}
        footer={<><button className="btn btn-secondary" onClick={fechar}>Cancelar</button>
          <button className="btn btn-primary" form="form-pagamento" type="submit">Salvar</button></>}>
        {editando && <RegistradoPor registro={editando} variante="bloco" />}
        <PagamentoForm key={editando?.id || 'novo'} pagamento={editando} pacientes={pacientes} dentistas={dentistas}
          procedimentos={procedimentos} onSubmit={salvarPagamento} dentistaPadrao={filtroDentista} />
      </Modal>

      <Modal open={modal === 'despesa'} onClose={fechar} size="lg"
        title={editando ? 'Editar Gasto' : 'Novo Gasto da Empresa'}
        footer={<><button className="btn btn-secondary" onClick={fechar}>Cancelar</button>
          <button className="btn btn-primary" form="form-despesa" type="submit">Salvar</button></>}>
        {editando && <RegistradoPor registro={editando} variante="bloco" />}
        <DespesaForm key={editando?.id || 'nova'} despesa={editando} categorias={categorias.despesas} dentistas={dentistas}
          onSubmit={salvarDespesa} dentistaPadrao={filtroDentista} />
      </Modal>

      <Modal open={modal === 'receita'} onClose={fechar} size="lg"
        title={editando ? 'Editar Receita' : 'Nova Receita'}
        footer={<><button className="btn btn-secondary" onClick={fechar}>Cancelar</button>
          <button className="btn btn-primary" form="form-receita" type="submit">Salvar</button></>}>
        {editando && <RegistradoPor registro={editando} variante="bloco" />}
        <ReceitaForm key={editando?.id || 'nova'} receita={editando} categorias={categorias.receitas} dentistas={dentistas}
          onSubmit={salvarReceita} dentistaPadrao={filtroDentista} />
      </Modal>

      <ReciboModal
        aberto={Boolean(reciboModal)}
        onFechar={() => setReciboModal(null)}
        pagamento={reciboModal?.pagamento || null}
        recibo={reciboModal?.recibo || null}
        pacientes={pacientes}
        dentistas={dentistas}
        onEmitido={() => { carregarRecibos(); carregar(); }}
      />
    </div>
  );
}
