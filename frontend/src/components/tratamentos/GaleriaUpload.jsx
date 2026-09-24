import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { prepararImagem } from '../common/FotoUpload';

export const MAX_IMAGENS = 10;

/**
 * Galeria de imagens do tratamento (até 10).
 * `valor` é a lista de imagens: caminhos já salvos (/uploads/...) ou
 * imagens novas (data URL, reduzidas no navegador antes do envio).
 */
export default function GaleriaUpload({ valor = [], onChange, maximo = MAX_IMAGENS }) {
  const inputRef = useRef(null);
  const [processando, setProcessando] = useState(0);
  const restante = maximo - valor.length;

  const selecionar = async (e) => {
    const arquivos = [...(e.target.files || [])];
    e.target.value = '';
    if (!arquivos.length) return;

    const imagens = arquivos.filter((a) => a.type.startsWith('image/') && a.size <= 15 * 1024 * 1024);
    if (imagens.length < arquivos.length) toast.error('Alguns arquivos foram ignorados (só imagens de até 15 MB)');
    if (imagens.length > restante) toast.error(`Limite de ${maximo} imagens por tratamento — só as primeiras ${restante} foram adicionadas`);
    const lote = imagens.slice(0, Math.max(restante, 0));
    if (!lote.length) return;

    setProcessando(lote.length);
    const prontas = [];
    for (const arquivo of lote) {
      try {
        prontas.push(await prepararImagem(arquivo));
      } catch (err) {
        toast.error(err.message || 'Falha ao processar a imagem');
      }
    }
    setProcessando(0);
    if (prontas.length) onChange([...valor, ...prontas].slice(0, maximo));
  };

  const remover = (i) => onChange(valor.filter((_, idx) => idx !== i));

  return (
    <div className="form-group">
      <label className="form-label">
        Imagens <span className="text-muted text-xs">({valor.length}/{maximo} — opcional)</span>
      </label>

      <div className="galeria-grade">
        {valor.map((src, i) => (
          <div key={`${i}-${src.slice(-24)}`} className="galeria-item">
            <img src={src} alt={`Imagem ${i + 1}`} />
            <button type="button" className="galeria-remover" onClick={() => remover(i)} title="Remover imagem">
              <X size={13} />
            </button>
          </div>
        ))}

        {processando > 0 && (
          <div className="galeria-item galeria-adicionar" aria-busy="true">
            <Loader2 size={20} className="girando" />
            <span className="text-xs">Preparando…</span>
          </div>
        )}

        {restante > 0 && !processando && (
          <button type="button" className="galeria-item galeria-adicionar" onClick={() => inputRef.current?.click()}>
            <ImagePlus size={22} />
            <span className="text-xs">Adicionar</span>
          </button>
        )}
      </div>
      <p className="text-xs text-muted" style={{ marginTop: 6 }}>JPG, PNG ou WebP. Dá para escolher várias de uma vez.</p>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={selecionar} style={{ display: 'none' }} />
    </div>
  );
}
