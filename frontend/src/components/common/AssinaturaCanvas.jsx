import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Quadro para o paciente assinar com o dedo, caneta de tablet ou mouse.
 * Usa Pointer Events (funciona em toque e mouse) e ajusta a resolução
 * à tela para o traço não ficar serrilhado.
 *
 * ref.current.vazio()      → true se ainda não assinou
 * ref.current.limpar()     → apaga o quadro
 * ref.current.imagem()     → PNG (data URL) recortado, ou null
 */
const AssinaturaCanvas = forwardRef(function AssinaturaCanvas({ onMudar }, ref) {
  const canvasRef = useRef(null);
  const desenhando = useRef(false);
  const ultimo = useRef(null);
  const [temTraco, setTemTraco] = useState(false);

  // Ajusta o tamanho interno do canvas ao tamanho exibido
  useEffect(() => {
    const canvas = canvasRef.current;
    const ajustar = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      // Redimensionar apaga o conteúdo: guarda e redesenha
      const copia = canvas.width ? canvas.toDataURL() : null;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      if (copia && temTraco) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, width, height);
        img.src = copia;
      }
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ponto = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const iniciar = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    desenhando.current = true;
    ultimo.current = ponto(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(ultimo.current.x, ultimo.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  };

  const mover = (e) => {
    if (!desenhando.current) return;
    e.preventDefault();
    const p = ponto(e);
    const ctx = canvasRef.current.getContext('2d');
    // Caneta com pressão desenha traço um pouco mais grosso
    ctx.lineWidth = e.pressure && e.pointerType === 'pen' ? 1.4 + e.pressure * 2 : 2.2;
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
    if (!temTraco) { setTemTraco(true); onMudar?.(true); }
  };

  const terminar = () => { desenhando.current = false; };

  useImperativeHandle(ref, () => ({
    vazio: () => !temTraco,
    limpar: () => {
      const c = canvasRef.current;
      c.getContext('2d').clearRect(0, 0, c.width, c.height);
      setTemTraco(false);
      onMudar?.(false);
    },
    /** PNG com fundo branco, recortado ao redor da assinatura. */
    imagem: () => {
      if (!temTraco) return null;
      const c = canvasRef.current;
      const ctx = c.getContext('2d');
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      let minX = width, minY = height, maxX = 0, maxY = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (data[(y * width + x) * 4 + 3] > 0) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX <= minX || maxY <= minY) return null;
      const margem = 12;
      const w = maxX - minX + margem * 2;
      const h = maxY - minY + margem * 2;
      const saida = document.createElement('canvas');
      saida.width = w; saida.height = h;
      const sctx = saida.getContext('2d');
      sctx.fillStyle = '#fff';
      sctx.fillRect(0, 0, w, h);
      sctx.drawImage(c, minX - margem, minY - margem, w, h, 0, 0, w, h);
      return saida.toDataURL('image/png');
    },
  }), [temTraco, onMudar]);

  return (
    <div className="assinatura-quadro">
      <canvas
        ref={canvasRef}
        aria-label="Quadro de assinatura: assine com o dedo, caneta ou mouse"
        role="img"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onPointerLeave={terminar}
      />
      <div className="assinatura-linha" />
      {!temTraco && <div className="assinatura-dica">Assine aqui com o dedo, a caneta ou o mouse</div>}
    </div>
  );
});

export default AssinaturaCanvas;
