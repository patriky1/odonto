import { useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const LADO_MAXIMO = 1400;   // px — reduz a imagem antes de enviar
const QUALIDADE = 0.82;     // compressão JPEG

/**
 * Redimensiona a imagem no próprio navegador e devolve uma data URL.
 * Evita enviar fotos de 8 MB direto da câmera do celular.
 */
export const prepararImagem = (arquivo, ladoMaximo = LADO_MAXIMO) => new Promise((resolve, reject) => {
  const leitor = new FileReader();
  leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
  leitor.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Arquivo de imagem inválido'));
    img.onload = () => {
      const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
      const largura = Math.round(img.width * escala);
      const altura = Math.round(img.height * escala);

      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, largura, altura);
      ctx.drawImage(img, 0, 0, largura, altura);

      resolve(canvas.toDataURL('image/jpeg', QUALIDADE));
    };
    img.src = leitor.result;
  };
  leitor.readAsDataURL(arquivo);
});

/**
 * Campo de foto opcional: mostra a prévia, permite trocar e remover.
 * `valor` pode ser uma data URL (nova) ou um caminho /uploads/... (já salvo).
 */
export default function FotoUpload({ label, valor, onChange, ajuda }) {
  const inputRef = useRef(null);
  const [processando, setProcessando] = useState(false);

  const selecionar = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (arquivo.size > 15 * 1024 * 1024) {
      toast.error('Imagem muito grande (máximo 15 MB)');
      return;
    }

    setProcessando(true);
    try {
      onChange(await prepararImagem(arquivo));
    } catch (err) {
      toast.error(err.message || 'Falha ao processar a imagem');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">
        {label} <span className="text-muted text-xs">(opcional)</span>
      </label>

      <div
        style={{
          border: `2px dashed ${valor ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: valor ? 8 : 20,
          textAlign: 'center',
          background: 'var(--bg)',
          position: 'relative',
          minHeight: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {processando ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Loader2 size={22} className="girando" />
            <span className="text-sm text-muted">Preparando imagem…</span>
          </div>
        ) : valor ? (
          <div style={{ width: '100%' }}>
            <img
              src={valor}
              alt={label}
              style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 6, display: 'block' }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
                <Upload size={13} /> Trocar
              </button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onChange('')}>
                <X size={13} /> Remover
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <ImageIcon size={28} />
            <span className="text-sm">Clique para enviar uma foto</span>
            {ajuda && <span className="text-xs">{ajuda}</span>}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={selecionar} style={{ display: 'none' }} />
    </div>
  );
}
