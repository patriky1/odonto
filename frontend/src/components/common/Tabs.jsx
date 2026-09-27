import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Barra de abas com scroll horizontal e indicação discreta de que há
 * mais opções para os lados (setas + fade), essencial no mobile onde
 * o usuário não enxerga que pode arrastar.
 *
 * abas: [{ id, label, icon? }]
 */
export default function Tabs({ abas, ativa, onChange }) {
  const scrollRef = useRef(null);
  const [podeEsquerda, setPodeEsquerda] = useState(false);
  const [podeDireita, setPodeDireita] = useState(false);

  const atualizarSetas = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setPodeEsquerda(el.scrollLeft > 4);
    setPodeDireita(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    atualizarSetas();
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', atualizarSetas, { passive: true });
    window.addEventListener('resize', atualizarSetas);
    return () => {
      el.removeEventListener('scroll', atualizarSetas);
      window.removeEventListener('resize', atualizarSetas);
    };
  }, [atualizarSetas, abas]);

  const rolar = (dir) => scrollRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });

  return (
    <div className="tabs-wrapper">
      {podeEsquerda && (
        <>
          <div className="tabs-fade tabs-fade-left" />
          <button type="button" className="tabs-arrow tabs-arrow-left" onClick={() => rolar(-1)} aria-label="Ver abas anteriores">
            <ChevronLeft size={14} />
          </button>
        </>
      )}

      <div className="tabs" ref={scrollRef}>
        {abas.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${ativa === t.id ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.icon && <t.icon size={14} />}
            {t.label}
          </button>
        ))}
      </div>

      {podeDireita && (
        <>
          <div className="tabs-fade tabs-fade-right" />
          <button type="button" className="tabs-arrow tabs-arrow-right" onClick={() => rolar(1)} aria-label="Ver mais abas">
            <ChevronRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}