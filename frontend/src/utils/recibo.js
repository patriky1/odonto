import { formatCurrency, formatDate } from './formatters';

/* ================================================================== *
 * VALOR POR EXTENSO
 * Exigido em recibo: "R$ 640,00 (seiscentos e quarenta reais)".
 * ================================================================== */

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** Escreve um número de 1 a 999. */
const ateNovecentos = (n) => {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (d === 1) partes.push(DEZ_A_DEZENOVE[u]);
  else {
    if (d) partes.push(DEZENAS[d]);
    if (u) partes.push(UNIDADES[u]);
  }
  return partes.join(' e ');
};

const GRUPOS = [
  { divisor: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
  { divisor: 1_000_000, singular: 'milhão', plural: 'milhões' },
  { divisor: 1_000, singular: 'mil', plural: 'mil' },
];

/** Escreve um número inteiro por extenso (até bilhões). */
const inteiroPorExtenso = (valor) => {
  let n = Math.floor(Math.abs(valor));
  if (n === 0) return 'zero';

  const partes = [];
  for (const { divisor, singular, plural } of GRUPOS) {
    const qtd = Math.floor(n / divisor);
    if (qtd > 0) {
      // "mil" não leva "um" na frente: 1.500 → "mil e quinhentos"
      if (divisor === 1000 && qtd === 1) partes.push('mil');
      else partes.push(`${ateNovecentos(qtd)} ${qtd === 1 ? singular : plural}`);
      n %= divisor;
    }
  }
  if (n > 0) partes.push(ateNovecentos(n));

  // Liga o último grupo com "e" quando ele é menor que cem ou múltiplo de cem
  if (partes.length > 1) {
    const ultimo = partes.pop();
    const resto = Math.floor(Math.abs(valor)) % 1000;
    const conector = resto > 0 && (resto < 100 || resto % 100 === 0) ? ' e ' : ', ';
    return `${partes.join(', ')}${conector}${ultimo}`;
  }
  return partes.join('');
};

/** "seiscentos e quarenta reais" / "um real e cinquenta centavos" */
export const valorPorExtenso = (valor) => {
  const v = Math.round((parseFloat(valor) || 0) * 100) / 100;
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);

  const partes = [];
  if (reais > 0) {
    // "um milhão DE reais", mas "um milhão, duzentos mil reais"
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? 'de ' : '';
    partes.push(`${inteiroPorExtenso(reais)} ${de}${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (partes.length === 0) return 'zero real';
  return partes.join(' e ');
};

/* ================================================================== *
 * APOIO
 * ================================================================== */

const FORMAS = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  debito_automatico: 'Débito Automático',
  parcelado: 'Parcelado',
};

export const rotuloForma = (f) => FORMAS[f] || (f ? String(f).replace(/_/g, ' ') : '');

export const formatarDocumento = (doc, tipo) => {
  const d = String(doc || '').replace(/\D/g, '');
  if (!d) return '';
  if (tipo === 'CPF' || d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
};

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Endereço da empresa em uma linha só. */
export const enderecoEmpresa = (e = {}) => [
  e.endereco,
  e.bairro,
  [e.cidade, e.estado].filter(Boolean).join('/'),
  e.cep && `CEP ${e.cep}`,
].filter(Boolean).join(' · ');

/* ================================================================== *
 * DOCUMENTO IMPRESSO
 * ================================================================== */

/** Uma via do recibo (o miolo do papel). */
const umaVia = (r, rotuloVia) => {
  const e = r.empresa || {};
  const prof = r.profissional || {};
  const contatos = [e.telefone, e.email, e.site].filter(Boolean).join(' · ');
  const cidadeAssinatura = e.cidade ? `${e.cidade}${e.estado ? `/${e.estado}` : ''}` : '';

  return `
  <section class="via">
    ${r.cancelado ? '<div class="cancelado">CANCELADO</div>' : ''}
    <header class="cabecalho">
      ${e.logo ? `<img class="logo" src="${esc(e.logo)}" alt="" />` : ''}
      <div class="empresa">
        <h1>${esc(e.nomeFantasia || e.razaoSocial)}</h1>
        ${e.nomeFantasia && e.razaoSocial && e.nomeFantasia !== e.razaoSocial ? `<p>${esc(e.razaoSocial)}</p>` : ''}
        ${e.documento ? `<p>${esc(e.tipoDocumento || 'CNPJ')}: ${esc(formatarDocumento(e.documento, e.tipoDocumento))}</p>` : ''}
        ${enderecoEmpresa(e) ? `<p>${esc(enderecoEmpresa(e))}</p>` : ''}
        ${contatos ? `<p>${esc(contatos)}</p>` : ''}
      </div>
      <div class="identificacao">
        <span class="rotulo-via">${esc(rotuloVia)}</span>
        <span class="numero">RECIBO Nº ${esc(r.numeroFormatado)}</span>
        <span class="valor">${esc(formatCurrency(r.valor))}</span>
      </div>
    </header>

    <p class="corpo">
      Recebi de <strong>${esc(r.pagadorNome)}</strong>${r.pagadorCpf ? `, CPF ${esc(formatarDocumento(r.pagadorCpf, 'CPF'))}` : ''}
      a importância de <strong>${esc(formatCurrency(r.valor))}</strong>
      (${esc(valorPorExtenso(r.valor))}),
      referente a <strong>${esc(r.descricao)}</strong>${
        r.paciente?.nome && r.paciente.nome !== r.pagadorNome
          ? `, em atendimento ao paciente <strong>${esc(r.paciente.nome)}</strong>`
          : ''
      }${r.formaPagamento ? `, pago em ${esc(rotuloForma(r.formaPagamento))}` : ''},
      dando plena quitação pelo valor recebido.
    </p>

    <table class="detalhes">
      <tbody>
        <tr>
          <td><span>Paciente</span>${esc(r.paciente?.nome || r.pagadorNome)}</td>
          <td><span>Data do pagamento</span>${esc(formatDate(r.dataPagamento))}</td>
        </tr>
        <tr>
          <td><span>Profissional responsável</span>${esc(prof.nome || e.responsavel || '—')}${prof.cro ? ` — CRO ${esc(prof.cro)}` : ''}</td>
          <td><span>Forma de pagamento</span>${esc(rotuloForma(r.formaPagamento) || '—')}</td>
        </tr>
      </tbody>
    </table>

    ${r.observacoes ? `<p class="observacoes"><span>Observações:</span> ${esc(r.observacoes)}</p>` : ''}

    <div class="assinatura">
      <p class="local-data">${cidadeAssinatura ? `${esc(cidadeAssinatura)}, ` : ''}${esc(formatDate(String(r.dataEmissao || '').split('T')[0] || r.dataPagamento))}</p>
      <div class="linha"></div>
      <p class="nome-assinatura">${esc(e.razaoSocial || e.nomeFantasia)}</p>
      ${e.documento ? `<p class="doc-assinatura">${esc(e.tipoDocumento || 'CNPJ')}: ${esc(formatarDocumento(e.documento, e.tipoDocumento))}</p>` : ''}
    </div>

    <footer class="rodape">
      ${e.observacaoRecibo ? `<p>${esc(e.observacaoRecibo)}</p>` : ''}
      <p>Emitido em ${esc(formatDate(String(r.dataEmissao || '').split('T')[0]))}${r.usuarioNome ? ` por ${esc(r.usuarioNome)}` : ''} · Documento gerado pelo sistema de gestão da clínica.</p>
    </footer>
  </section>`;
};

const ESTILO = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #0f172a; margin: 0; font-size: 12px; line-height: 1.55;
    background: #fff;
  }
  .via {
    position: relative;
    border: 1px solid #cbd5e1; border-radius: 10px;
    padding: 18px 22px; margin-bottom: 14px;
  }
  .via + .via { border-top-style: dashed; }
  .cabecalho { display: flex; gap: 14px; align-items: flex-start; border-bottom: 2px solid #00959b; padding-bottom: 12px; }
  .logo { max-height: 64px; max-width: 150px; object-fit: contain; }
  .empresa { flex: 1; min-width: 0; }
  .empresa h1 { font-size: 16px; margin: 0 0 2px; color: #026060; }
  .empresa p { margin: 0; font-size: 10.5px; color: #475569; }
  .identificacao { text-align: right; display: flex; flex-direction: column; gap: 2px; white-space: nowrap; }
  .rotulo-via { font-size: 9px; letter-spacing: .8px; text-transform: uppercase; color: #64748b; }
  .numero { font-size: 12px; font-weight: 700; color: #0f172a; }
  .valor { font-size: 20px; font-weight: 700; color: #026060; }
  .corpo { margin: 16px 0; text-align: justify; font-size: 12.5px; }
  .detalhes { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .detalhes td {
    width: 50%; border: 1px solid #e2e8f0; padding: 6px 10px;
    font-size: 11.5px; vertical-align: top;
  }
  .detalhes span {
    display: block; font-size: 8.5px; text-transform: uppercase;
    letter-spacing: .5px; color: #64748b; margin-bottom: 1px;
  }
  .observacoes { font-size: 11px; color: #334155; margin: 0 0 10px; }
  .observacoes span { font-weight: 600; }
  .assinatura { text-align: center; margin: 26px 0 10px; }
  .local-data { margin: 0 0 30px; font-size: 11.5px; }
  .linha { width: 62%; margin: 0 auto; border-top: 1px solid #0f172a; }
  .nome-assinatura { margin: 4px 0 0; font-weight: 600; font-size: 11.5px; }
  .doc-assinatura { margin: 0; font-size: 10px; color: #475569; }
  .rodape { border-top: 1px solid #e2e8f0; padding-top: 6px; }
  .rodape p { margin: 0; font-size: 9px; color: #64748b; text-align: center; }
  .cancelado {
    position: absolute; top: 40%; left: 0; right: 0; text-align: center;
    font-size: 54px; font-weight: 800; color: rgba(239,68,68,.22);
    transform: rotate(-16deg); letter-spacing: 6px; pointer-events: none;
  }
  @media print {
    .via { border-color: #94a3b8; page-break-inside: avoid; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/**
 * HTML completo do recibo.
 * @param {object} recibo  registro devolvido pela API (/api/recibos)
 * @param {number} vias    1 = só a via do cliente; 2 = cliente + clínica
 */
export const montarHtmlRecibo = (recibo, { vias = 2 } = {}) => {
  const corpo = vias >= 2
    ? umaVia(recibo, 'Via do cliente') + umaVia(recibo, 'Via da clínica')
    : umaVia(recibo, 'Via do cliente');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Recibo ${esc(recibo.numeroFormatado)} — ${esc(recibo.pagadorNome)}</title>
  <style>${ESTILO}</style>
</head>
<body>${corpo}</body>
</html>`;
};

/**
 * Abre a caixa de impressão do navegador com o recibo pronto.
 * Usa um iframe oculto — não depende de pop-up liberado e permite
 * "Salvar como PDF" pela própria impressão.
 */
export const imprimirRecibo = (recibo, { vias = 2 } = {}) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  frame.onload = () => {
    const janela = frame.contentWindow;
    // Pequena espera para a logomarca terminar de renderizar antes da impressão
    setTimeout(() => {
      try {
        janela.focus();
        janela.print();
      } finally {
        setTimeout(() => frame.remove(), 1500);
      }
    }, 300);
  };

  frame.srcdoc = montarHtmlRecibo(recibo, { vias });
};

/** Texto curto do recibo para enviar ao paciente pelo WhatsApp. */
export const textoReciboWhatsApp = (recibo) => {
  const e = recibo.empresa || {};
  return [
    `*Recibo nº ${recibo.numeroFormatado}*`,
    e.nomeFantasia || e.razaoSocial,
    '',
    `Recebemos de ${recibo.pagadorNome} o valor de ${formatCurrency(recibo.valor)}`,
    `Referente a: ${recibo.descricao}`,
    `Data do pagamento: ${formatDate(recibo.dataPagamento)}`,
    rotuloForma(recibo.formaPagamento) ? `Forma: ${rotuloForma(recibo.formaPagamento)}` : '',
    '',
    'Obrigado pela confiança!',
  ].filter(Boolean).join('\n');
};
