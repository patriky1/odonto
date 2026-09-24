import { useEffect, useState } from 'react';

/** Mesmo limite usado no CSS (@media (max-width: 768px)). */
export const LIMITE_MOBILE = 768;
const CONSULTA = `(max-width: ${LIMITE_MOBILE}px)`;

const confere = () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches;

/** true quando a tela é de celular. Atualiza sozinho se a tela girar/mudar de tamanho. */
export default function useIsMobile() {
  const [mobile, setMobile] = useState(confere);

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const aoMudar = (e) => setMobile(e.matches);
    setMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', aoMudar);
    else mq.addListener(aoMudar); // Safari antigo
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', aoMudar);
      else mq.removeListener(aoMudar);
    };
  }, []);

  return mobile;
}
