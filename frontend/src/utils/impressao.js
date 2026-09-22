import { enderecoEmpresa, formatarDocumento } from './recibo';
import { formatDate, formatCPF, calcularIdade, formatDataHoraBanco } from './formatters';

/* ================================================================== *
 * IMPRESSÃO DE DOCUMENTOS (termo de consentimento e prontuário)
 * Mesmo mecanismo do recibo: iframe oculto + caixa de impressão do
 * navegador, que também permite "Salvar como PDF".
 * ================================================================== */

export const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Texto com quebras de linha → parágrafos HTML. */
const paragrafos = (texto) => String(texto || '')
  .split(/\n{2,}/)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`)
  .join('');

/** "CRO 12345" — sem repetir o prefixo quando o cadastro já traz "CRO-PB 12345". */
export const croTexto = (v) => {
  const t = String(v || '').trim();
  if (!t) return '';
  return /^cro/i.test(t) ? t : `CRO ${t}`;
};

const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '');

const ESTILO_BASE = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; font-size: 12px; line-height: 1.6; background: #fff; }
  .cabecalho { display: flex; gap: 14px; align-items: center; border-bottom: 2px solid #00959b; padding-bottom: 10px; margin-bottom: 18px; }
  .logo { max-height: 60px; max-width: 150px; object-fit: contain; }
  .empresa h1 { font-size: 15px; margin: 0 0 2px; color: #026060; }
  .empresa p { margin: 0; font-size: 10.5px; color: #475569; }
  h2 { font-size: 16px; text-align: center; margin: 0 0 16px; color: #0f172a; }
  h3 { font-size: 12.5px; margin: 18px 0 6px; color: #026060; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .texto p { margin: 0 0 10px; text-align: justify; font-size: 12.5px; }
  .ident { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .ident td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 11.5px; vertical-align: top; }
  .ident span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .4px; color: #64748b; }
  .assinaturas { display: flex; gap: 40px; justify-content: space-around; margin-top: 44px; page-break-inside: avoid; }
  .assinatura { flex: 1; max-width: 300px; text-align: center; font-size: 11px; }
  .assinatura img { max-height: 70px; max-width: 240px; display: block; margin: 0 auto -6px; }
  .assinatura .linha { border-top: 1px solid #0f172a; margin-top: 50px; padding-top: 4px; }
  .assinatura img + .linha { margin-top: 0; }
  .assinatura small { display: block; color: #475569; font-size: 10px; }
  .selo { margin-top: 18px; padding: 8px 10px; border: 1px dashed #94a3b8; border-radius: 6px; font-size: 10px; color: #475569; }
  .alertas { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 6px 10px; color: #92400e; }
  .alertas ul { margin: 2px 0 0; padding-left: 16px; }
  .evento { border-left: 3px solid #cbd5e1; padding: 2px 0 2px 10px; margin-bottom: 10px; page-break-inside: avoid; }
  .evento .topo { display: flex; justify-content: space-between; gap: 10px; }
  .evento strong { font-size: 12px; }
  .evento .data { color: #64748b; font-size: 10.5px; white-space: nowrap; }
  .evento .sub { color: #475569; font-size: 11px; }
  .evento ul { margin: 3px 0 0; padding-left: 16px; font-size: 11px; }
  .evento .campo { font-size: 11px; margin-top: 2px; white-space: pre-wrap; }
  .evento .campo b { color: #475569; }
  .lista-simples { margin: 0; padding-left: 16px; }
  .rodape { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9px; color: #64748b; text-align: center; }
  .revogado { color: #b91c1c; font-weight: 700; text-align: center; border: 2px solid #b91c1c; padding: 6px; margin-bottom: 14px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

const cabecalhoEmpresa = (e = {}) => {
  const contatos = [e.telefone, e.email, e.site].filter(Boolean).join(' · ');
  const nome = e.nomeFantasia || e.razaoSocial;
  if (!nome && !e.logo) return '';
  return `
  <header class="cabecalho">
    ${e.logo ? `<img class="logo" src="${esc(e.logo)}" alt="" />` : ''}
    <div class="empresa">
      <h1>${esc(nome)}</h1>
      ${e.documento ? `<p>${esc(e.tipoDocumento || 'CNPJ')}: ${esc(formatarDocumento(e.documento, e.tipoDocumento))}</p>` : ''}
      ${enderecoEmpresa(e) ? `<p>${esc(enderecoEmpresa(e))}</p>` : ''}
      ${contatos ? `<p>${esc(contatos)}</p>` : ''}
    </div>
  </header>`;
};

const documento = (titulo, corpo) => `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><title>${esc(titulo)}</title><style>${ESTILO_BASE}</style></head>
<body>${corpo}</body>
</html>`;

/** Abre a caixa de impressão com o HTML informado. */
export const imprimirHtml = (html) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  frame.onload = () => {
    const janela = frame.contentWindow;
    setTimeout(() => {
      try { janela.focus(); janela.print(); } finally { setTimeout(() => frame.remove(), 1500); }
    }, 350);
  };
  frame.srcdoc = html;
};

/* ------------------------------------------------------------------ *
 * TERMO DE CONSENTIMENTO
 * ------------------------------------------------------------------ */

export const montarHtmlTermo = (termo, { empresa = {}, paciente = {} } = {}) => {
  const assinadoDigital = termo.status !== 'pendente' && termo.formaAssinatura === 'digital' && termo.assinaturaImagem;
  const origem = window.location.origin;
  const imagem = assinadoDigital
    ? (termo.assinaturaImagem.startsWith('/') ? `${origem}${termo.assinaturaImagem}` : termo.assinaturaImagem)
    : null;

  const nomeAssinante = termo.assinanteNome || (paciente.responsavel || paciente.nome || '');
  const docAssinante = termo.assinanteDocumento || (!termo.assinanteNome && paciente.cpf ? formatCPF(paciente.cpf) : '');
  const relacao = termo.assinanteRelacao === 'responsavel' ? 'Responsável legal' : 'Paciente';

  const corpo = `
    ${cabecalhoEmpresa(empresa)}
    ${termo.status === 'revogado' ? `<div class="revogado">TERMO REVOGADO EM ${esc(formatDataHoraBanco(termo.revogadoEm))}${termo.motivoRevogacao ? ` — ${esc(termo.motivoRevogacao)}` : ''}</div>` : ''}
    <h2>${esc(termo.titulo)}</h2>
    <table class="ident"><tbody><tr>
      <td><span>Paciente</span>${esc(paciente.nome || termo.pacienteNome)}</td>
      <td><span>CPF</span>${esc(paciente.cpf ? formatCPF(paciente.cpf) : '—')}</td>
      <td><span>Nascimento</span>${esc(paciente.dataNascimento ? `${formatDate(paciente.dataNascimento)} (${calcularIdade(paciente.dataNascimento)} anos)` : '—')}</td>
    </tr><tr>
      <td colspan="2"><span>Procedimento</span>${esc(termo.procedimento || '—')}</td>
      <td><span>Profissional</span>${esc(termo.dentistaNome || empresa.responsavel || '—')}${termo.dentistaCro ? ` — ${esc(croTexto(termo.dentistaCro))}` : ''}</td>
    </tr></tbody></table>
    <div class="texto">${paragrafos(termo.conteudo)}</div>
    <div class="assinaturas">
      <div class="assinatura">
        ${imagem ? `<img src="${esc(imagem)}" alt="Assinatura" />` : ''}
        <div class="linha">${esc(nomeAssinante) || '&nbsp;'}</div>
        <small>${esc(relacao)}${docAssinante ? ` — ${esc(docAssinante)}` : ''}</small>
      </div>
      <div class="assinatura">
        <div class="linha">${esc(termo.dentistaNome || empresa.responsavel || 'Profissional responsável')}</div>
        <small>${esc(croTexto(termo.dentistaCro || empresa.cro) || 'Cirurgião(ã)-dentista')}</small>
      </div>
    </div>
    ${assinadoDigital ? `<div class="selo">Assinado na tela do sistema em ${esc(formatDataHoraBanco(termo.assinadoEm))} por ${esc(termo.assinanteNome)}${termo.assinanteDocumento ? ` (${esc(termo.assinanteDocumento)})` : ''}. Termo nº ${esc(termo.id)}.</div>` : ''}
    ${termo.status !== 'pendente' && termo.formaAssinatura === 'papel' ? `<div class="selo">Assinatura registrada em papel em ${esc(formatDataHoraBanco(termo.assinadoEm))}. Termo nº ${esc(termo.id)}.</div>` : ''}
    <div class="rodape">Documento gerado pelo sistema de gestão da clínica.</div>`;
  return documento(`${termo.titulo} — ${paciente.nome || termo.pacienteNome || ''}`, corpo);
};

/* ------------------------------------------------------------------ *
 * PRONTUÁRIO
 * ------------------------------------------------------------------ */

export const montarHtmlProntuario = (dados, { empresa = {}, tipos = null } = {}) => {
  const p = dados.paciente || {};
  const r = dados.resumo || {};
  const eventos = (dados.eventos || []).filter((e) => !tipos || tipos.includes(e.tipo));

  const blocoEvento = (e) => `
    <div class="evento">
      <div class="topo">
        <strong>${esc(e.titulo)}</strong>
        <span class="data">${esc(e.soData ? formatDate(String(e.quando).slice(0, 10)) : quando(e.quando))}</span>
      </div>
      ${e.subtitulo ? `<div class="sub">${esc(e.subtitulo)}</div>` : ''}
      ${e.dentista || e.responsavel ? `<div class="sub">${e.dentista ? `Profissional: ${esc(e.dentista)}` : ''}${e.dentista && e.responsavel ? ' · ' : ''}${e.responsavel ? `Registrado por: ${esc(e.responsavel)}` : ''}</div>` : ''}
      ${(e.campos || []).map((c) => `<div class="campo"><b>${esc(c.rotulo)}:</b> ${esc(c.texto)}</div>`).join('')}
      ${e.detalhes?.length ? `<ul>${e.detalhes.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    </div>`;

  const corpo = `
    ${cabecalhoEmpresa(empresa)}
    <h2>Prontuário Odontológico</h2>
    <table class="ident"><tbody><tr>
      <td><span>Paciente</span>${esc(p.nome)}</td>
      <td><span>CPF</span>${esc(p.cpf ? formatCPF(p.cpf) : '—')}</td>
      <td><span>Nascimento</span>${esc(p.dataNascimento ? `${formatDate(p.dataNascimento)} (${calcularIdade(p.dataNascimento)} anos)` : '—')}</td>
    </tr><tr>
      <td><span>Telefone</span>${esc(p.telefone || p.whatsapp || '—')}</td>
      <td><span>Responsável</span>${esc(p.responsavel || '—')}</td>
      <td><span>Endereço</span>${esc([p.endereco, p.cidade && `${p.cidade}/${p.estado || ''}`].filter(Boolean).join(' — ') || '—')}</td>
    </tr></tbody></table>

    ${dados.alertas?.length ? `<div class="alertas"><strong>Alertas clínicos</strong><ul>${dados.alertas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}

    <h3>Resumo</h3>
    <ul class="lista-simples">
      <li>Atendimentos realizados: ${esc(r.totalAtendimentos)}${r.primeiroAtendimento ? ` (de ${esc(formatDate(r.primeiroAtendimento))} a ${esc(formatDate(r.ultimoAtendimento))})` : ''}</li>
      <li>Faltas: ${esc(r.faltas)}</li>
      <li>Tratamentos: ${esc(r.tratamentos?.total)} (${esc(r.tratamentos?.ativos)} em aberto, ${esc(r.tratamentos?.concluidos)} concluídos)</li>
      ${r.dentistas?.length ? `<li>Profissionais: ${esc(r.dentistas.join(', '))}</li>` : ''}
    </ul>

    ${dados.ficha?.queixaPrincipal ? `<h3>Queixa principal</h3><p>${esc(dados.ficha.queixaPrincipal)}</p>` : ''}

    ${dados.odontograma?.resumo?.length ? `<h3>Odontograma — situação atual</h3><ul class="lista-simples">${dados.odontograma.resumo.map((o) => `<li>${esc(o.rotulo)}: dentes ${esc(o.dentes.join(', '))}</li>`).join('')}</ul>` : ''}

    ${dados.tratamentos?.length ? `<h3>Plano de tratamento</h3><ul class="lista-simples">${dados.tratamentos.map((t) => `<li>${esc(t.nome)} — ${esc(t.statusRotulo)} (${esc(t.sessoesRealizadas)}/${esc(t.sessoes)} sessões)${t.dentistaNome ? ` — ${esc(t.dentistaNome)}` : ''}</li>`).join('')}</ul>` : ''}

    <h3>Evolução clínica</h3>
    ${eventos.length ? eventos.map(blocoEvento).join('') : '<p>Nenhum registro.</p>'}

    <div class="assinaturas">
      <div class="assinatura">
        <div class="linha">${esc(empresa.responsavel || 'Profissional responsável')}</div>
        <small>${esc(croTexto(empresa.cro) || 'Cirurgião(ã)-dentista')}</small>
      </div>
    </div>
    <div class="rodape">Prontuário gerado em ${esc(quando(dados.geradoEm))} a partir dos registros do sistema.</div>`;
  return documento(`Prontuário — ${p.nome || ''}`, corpo);
};
