/* ================================================================== *
 * CONSTANTES CLÍNICAS DO ODONTOGRAMA (numeração FDI)
 * ================================================================== */

export const PERMANENTES_SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const PERMANENTES_INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const DECIDUOS_SUP = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
export const DECIDUOS_INF = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

export const STATUS_DENTE = [
  { value: '', label: 'Hígido', color: '#ffffff', border: '#d1d5db' },
  { value: 'cariado', label: 'Cariado', color: '#fef3c7', border: '#f59e0b' },
  { value: 'restaurado', label: 'Restaurado', color: '#dbeafe', border: '#2563eb' },
  { value: 'em_tratamento', label: 'Em tratamento', color: '#fae8ff', border: '#a21caf' },
  { value: 'tratamento_canal', label: 'Canal', color: '#d1fae5', border: '#059669' },
  { value: 'protese', label: 'Prótese', color: '#ede9fe', border: '#7c3aed' },
  { value: 'implante', label: 'Implante', color: '#e0f2fe', border: '#0284c7' },
  { value: 'selante', label: 'Selante', color: '#ecfccb', border: '#65a30d' },
  { value: 'fraturado', label: 'Fraturado', color: '#ffedd5', border: '#ea580c' },
  { value: 'indicado_extracao', label: 'Ind. extração', color: '#ffe4e6', border: '#e11d48' },
  { value: 'ausente', label: 'Ausente', color: '#fee2e2', border: '#ef4444' },
];

export const FACES = [
  { value: 'V', label: 'Vestibular' },
  { value: 'L', label: 'Lingual / Palatina' },
  { value: 'M', label: 'Mesial' },
  { value: 'D', label: 'Distal' },
  { value: 'O', label: 'Oclusal / Incisal' },
];

/** Alvo especial: procedimento sem dente (vale para a boca toda). */
export const BOCA_INTEIRA = 'boca';

export const infoStatus = (valor) => STATUS_DENTE.find((s) => s.value === (valor || '')) || STATUS_DENTE[0];

export const rotuloFace = (f) => FACES.find((x) => x.value === f)?.label || f;

/** ["O", "M"] → "M, O" (sempre na ordem V L M D O). */
export const ordenarFaces = (faces = []) => FACES.map((f) => f.value).filter((f) => faces.includes(f));

/**
 * A face mesial é a que fica voltada para a linha média da boca.
 * Na tela (visão de frente para o paciente), os quadrantes 1 e 4
 * (e os decíduos 5 e 8) ficam à esquerda da linha média: a mesial
 * deles aparece à DIREITA do desenho. Nos quadrantes 2 e 3 (6 e 7)
 * a mesial fica à esquerda.
 */
export const mesialNaDireita = (numeroDente) => [1, 4, 5, 8].includes(Math.floor(numeroDente / 10));
