import { infoStatus, mesialNaDireita } from './constantes';

/**
 * Desenho de um dente com as 5 faces clicáveis.
 * - Clique na borda do dente: seleciona o dente inteiro.
 * - Clique numa face: seleciona/desmarca a face (várias faces ao mesmo tempo).
 * A mesial fica sempre do lado da linha média (ver `mesialNaDireita`).
 */
export default function Dente({ numero, dados, selecionado, facesSelecionadas = [], onSelecionar, onFace, mostrarNumeroAcima }) {
  const geral = infoStatus(dados?.geral?.status);
  const faces = dados?.faces || {};
  const ausente = dados?.geral?.status === 'ausente';
  const [esquerda, direita] = mesialNaDireita(numero) ? ['D', 'M'] : ['M', 'D'];

  const corFace = (f) => (faces[f]?.status ? infoStatus(faces[f].status).color : 'transparent');
  const bordaFace = (f) => (faces[f]?.status ? infoStatus(faces[f].status).border : 'transparent');

  const estiloFace = (f) => {
    const marcada = selecionado && facesSelecionadas.includes(f);
    return {
      background: marcada && corFace(f) === 'transparent' ? 'rgba(37,99,235,.18)' : corFace(f),
      boxShadow: marcada ? `inset 0 0 0 2px ${bordaFace(f) === 'transparent' ? '#2563eb' : bordaFace(f)}` : 'none',
      cursor: 'pointer',
      transition: 'background .15s',
    };
  };

  const face = (f, titulo) => (
    <div onClick={(e) => { e.stopPropagation(); onFace(numero, f); }} style={estiloFace(f)} title={titulo} />
  );

  const numeroEl = (
    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, lineHeight: 1 }}>{numero}</span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {mostrarNumeroAcima && numeroEl}
      <div
        onClick={() => onSelecionar(numero)}
        title={`Dente ${numero}${dados?.geral?.status ? ` — ${geral.label}` : ''}`}
        style={{
          width: 32, height: 36, borderRadius: 6,
          border: `2px solid ${selecionado ? '#2563eb' : geral.border}`,
          background: geral.color,
          boxShadow: selecionado ? '0 0 0 3px rgba(37,99,235,.25)' : 'none',
          display: 'grid',
          gridTemplateColumns: '7px 1fr 7px',
          gridTemplateRows: '7px 1fr 7px',
          overflow: 'hidden', position: 'relative', cursor: 'pointer',
          opacity: ausente ? 0.55 : 1,
        }}
      >
        {/* linha 1 */}
        <div />
        {face('V', 'Vestibular')}
        <div />
        {/* linha 2 — mesial sempre voltada para a linha média */}
        {face(esquerda, esquerda === 'M' ? 'Mesial' : 'Distal')}
        {face('O', 'Oclusal / Incisal')}
        {face(direita, direita === 'M' ? 'Mesial' : 'Distal')}
        {/* linha 3 */}
        <div />
        {face('L', 'Lingual / Palatina')}
        <div />

        {ausente && (
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, color: '#ef4444', fontWeight: 700, pointerEvents: 'none',
          }}>✕</span>
        )}
      </div>
      {!mostrarNumeroAcima && numeroEl}
    </div>
  );
}
