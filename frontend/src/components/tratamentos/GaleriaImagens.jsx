import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/** Miniaturas da galeria; o clique abre a imagem em tela cheia (setas ← → navegam). */
export default function GaleriaImagens({ imagens = [], tamanho = 72 }) {
  const [aberta, setAberta] = useState(null); // índice da imagem ampliada

  useEffect(() => {
    if (aberta === null) return undefined;
    const tecla = (e) => {
      if (e.key === 'Escape') setAberta(null);
      if (e.key === 'ArrowRight') setAberta((i) => (i + 1) % imagens.length);
      if (e.key === 'ArrowLeft') setAberta((i) => (i - 1 + imagens.length) % imagens.length);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberta, imagens.length]);

  if (!imagens.length) return null;

  return (
    <>
      <div className="galeria-grade" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tamanho}px, ${tamanho}px))` }}>
        {imagens.map((src, i) => (
          <button key={src} type="button" className="galeria-item" onClick={() => setAberta(i)} title="Ampliar">
            <img src={src} alt={`Imagem ${i + 1}`} loading="lazy" />
          </button>
        ))}
      </div>

      {aberta !== null && (
        <div className="galeria-lightbox" onClick={(e) => { if (e.target === e.currentTarget) setAberta(null); }}>
          <button type="button" className="galeria-lightbox-fechar" onClick={() => setAberta(null)} title="Fechar"><X size={22} /></button>
          {imagens.length > 1 && (
            <button type="button" className="galeria-lightbox-nav" style={{ left: 12 }} title="Anterior"
              onClick={() => setAberta((i) => (i - 1 + imagens.length) % imagens.length)}><ChevronLeft size={28} /></button>
          )}
          <img src={imagens[aberta]} alt={`Imagem ${aberta + 1} de ${imagens.length}`} />
          {imagens.length > 1 && (
            <button type="button" className="galeria-lightbox-nav" style={{ right: 12 }} title="Próxima"
              onClick={() => setAberta((i) => (i + 1) % imagens.length)}><ChevronRight size={28} /></button>
          )}
          <span className="galeria-lightbox-contador">{aberta + 1} / {imagens.length}</span>
        </div>
      )}
    </>
  );
}
