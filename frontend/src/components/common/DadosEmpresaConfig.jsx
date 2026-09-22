import { useEffect, useRef, useState } from 'react';
import { Building2, Upload, Trash2, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { imprimirRecibo, formatarDocumento } from '../../utils/recibo';

const CAMPOS_VAZIOS = {
  razaoSocial: '', nomeFantasia: '', tipoDocumento: 'CNPJ', documento: '', cro: '',
  responsavel: '', endereco: '', bairro: '', cidade: '', estado: '', cep: '',
  telefone: '', email: '', site: '', logo: '', observacaoRecibo: '',
};

/** Reduz a logomarca antes de guardar (o recibo não precisa de imagem grande). */
const redimensionar = (arquivo, larguraMax = 420) => new Promise((resolve, reject) => {
  const leitor = new FileReader();
  leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
  leitor.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Arquivo de imagem inválido'));
    img.onload = () => {
      const escala = Math.min(1, larguraMax / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = leitor.result;
  };
  leitor.readAsDataURL(arquivo);
});

/** Dados da empresa impressos no cabeçalho dos recibos (somente admin). */
export default function DadosEmpresaConfig() {
  const [form, setForm] = useState(CAMPOS_VAZIOS);
  const [salvando, setSalvando] = useState(false);
  const inputLogo = useRef(null);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  useEffect(() => {
    api.get('/configuracoes/clinica')
      .then((r) => setForm({ ...CAMPOS_VAZIOS, ...r.data }))
      .catch(() => {});
  }, []);

  const trocarLogo = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem'); return; }
    try {
      const dataUrl = await redimensionar(arquivo);
      if (dataUrl.length > 400_000) { toast.error('Imagem muito pesada. Use uma logo menor.'); return; }
      setForm((f) => ({ ...f, logo: dataUrl }));
    } catch (erro) {
      toast.error(erro.message);
    }
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data } = await api.put('/configuracoes/clinica', form);
      setForm({ ...CAMPOS_VAZIOS, ...data });
      toast.success('Dados da empresa salvos');
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  /** Imprime um recibo fictício só para conferir o cabeçalho antes de usar com paciente. */
  const verModelo = () => {
    if (!form.razaoSocial) { toast.error('Preencha ao menos a razão social'); return; }
    const hoje = new Date().toISOString().split('T')[0];
    imprimirRecibo({
      numeroFormatado: `0000/${new Date().getFullYear()}`,
      valor: 250,
      descricao: 'Modelo de demonstração — nenhum valor foi cobrado',
      dataPagamento: hoje,
      dataEmissao: hoje,
      formaPagamento: 'pix',
      pagadorNome: 'Fulano de Tal',
      pagadorCpf: '00000000000',
      empresa: form,
      paciente: { nome: 'Fulano de Tal' },
      profissional: form.responsavel ? { nome: form.responsavel, cro: form.cro } : null,
      usuarioNome: 'Teste de impressão',
    }, { vias: 1 });
  };

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h3 className="card-title"><Building2 size={16} style={{ display: 'inline', marginRight: 6 }} />Dados da Empresa</h3>
      </div>

      <p className="text-sm text-muted mb-4">
        Estes dados formam o cabeçalho dos recibos entregues aos pacientes. Cada recibo guarda uma cópia
        das informações do momento da emissão, então alterações aqui não mudam documentos já impressos.
      </p>

      <form onSubmit={salvar}>
        {/* Logomarca */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ width: 150, height: 74, border: '1px dashed var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', overflow: 'hidden' }}>
            {form.logo
              ? <img src={form.logo} alt="Logomarca" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              : <span className="text-xs text-muted">Sem logomarca</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputLogo.current?.click()}>
              <Upload size={14} /> {form.logo ? 'Trocar logomarca' : 'Enviar logomarca'}
            </button>
            {form.logo && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                onClick={() => setForm((f) => ({ ...f, logo: '' }))}>
                <Trash2 size={14} /> Remover
              </button>
            )}
            <input ref={inputLogo} type="file" accept="image/*" onChange={trocarLogo} style={{ display: 'none' }} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Razão social / Nome <span className="required">*</span></label>
            <input className="form-control" value={form.razaoSocial} onChange={set('razaoSocial')} required
              placeholder="Nome que assina o recibo" />
          </div>
          <div className="form-group">
            <label className="form-label">Nome fantasia</label>
            <input className="form-control" value={form.nomeFantasia} onChange={set('nomeFantasia')}
              placeholder="Nome usado no cabeçalho" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tipo de documento</label>
            <select className="form-control" value={form.tipoDocumento} onChange={set('tipoDocumento')}>
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{form.tipoDocumento === 'CPF' ? 'CPF' : 'CNPJ'}</label>
            <input className="form-control" value={form.documento} onChange={set('documento')} placeholder="Somente números" />
            {form.documento && (
              <p className="text-xs text-muted mt-1">{formatarDocumento(form.documento, form.tipoDocumento)}</p>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Responsável técnico</label>
            <input className="form-control" value={form.responsavel} onChange={set('responsavel')}
              placeholder="Usado quando o recibo não indica um dentista" />
          </div>
          <div className="form-group">
            <label className="form-label">CRO do responsável</label>
            <input className="form-control" value={form.cro} onChange={set('cro')} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Endereço</label>
            <input className="form-control" value={form.endereco} onChange={set('endereco')} placeholder="Rua, número, complemento" />
          </div>
          <div className="form-group">
            <label className="form-label">Bairro</label>
            <input className="form-control" value={form.bairro} onChange={set('bairro')} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Cidade</label>
            <input className="form-control" value={form.cidade} onChange={set('cidade')} />
          </div>
          <div className="form-group">
            <label className="form-label">UF</label>
            <input className="form-control" value={form.estado} onChange={set('estado')} maxLength={2} />
          </div>
          <div className="form-group">
            <label className="form-label">CEP</label>
            <input className="form-control" value={form.cep} onChange={set('cep')} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-control" value={form.telefone} onChange={set('telefone')} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input type="email" className="form-control" value={form.email} onChange={set('email')} />
          </div>
          <div className="form-group">
            <label className="form-label">Site / Instagram</label>
            <input className="form-control" value={form.site} onChange={set('site')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Texto fixo no rodapé do recibo</label>
          <textarea className="form-control" rows={2} value={form.observacaoRecibo} onChange={set('observacaoRecibo')}
            placeholder="Ex.: Recibo válido para fins de Imposto de Renda." />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar dados da empresa'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={verModelo}>
            <Printer size={16} /> Ver modelo do recibo
          </button>
        </div>
      </form>
    </div>
  );
}
