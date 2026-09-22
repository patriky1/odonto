import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

/**
 * Controla a visibilidade dos valores financeiros.
 *
 * O desbloqueio:
 *  - vale só para a aba atual do navegador (sessionStorage);
 *  - pertence ao usuário que digitou a senha — ao sair do sistema ou
 *    entrar com outra conta, os valores voltam a ficar ocultos;
 *  - trava sozinho após alguns minutos sem uso (inatividade);
 *  - expira de qualquer forma após o prazo máximo definido pelo servidor.
 */

const FinanceiroContext = createContext(null);
const CHAVE = 'odonto_financeiro_liberado';
const CHAVE_ANTIGA = 'odonto_financeiro_liberado_ate';
export const INATIVIDADE_MIN = 10; // minutos sem mexer no sistema para ocultar de novo
const INATIVIDADE_MS = INATIVIDADE_MIN * 60 * 1000;

const lerDesbloqueio = () => {
  try { return JSON.parse(sessionStorage.getItem(CHAVE) || 'null'); } catch { return null; }
};
const limparDesbloqueio = () => {
  try { sessionStorage.removeItem(CHAVE); sessionStorage.removeItem(CHAVE_ANTIGA); } catch { /* noop */ }
};

export function FinanceiroProvider({ children }) {
  const { usuario, loading: carregandoLogin } = useAuth();
  const [liberado, setLiberado] = useState(false);
  const [status, setStatus] = useState(null);
  const ultimaAtividade = useRef(Date.now());

  // Restaura o desbloqueio só se ainda for válido E for do mesmo usuário.
  // Roda de novo sempre que o usuário logado muda (logout / troca de conta).
  useEffect(() => {
    if (carregandoLogin) return; // aguarda saber quem está logado (ex.: após F5)
    const d = lerDesbloqueio();
    if (usuario && d && d.usuarioId === usuario.id && Date.now() < d.ate) {
      ultimaAtividade.current = Date.now();
      setLiberado(true);
    } else {
      limparDesbloqueio();
      setLiberado(false);
    }
  }, [usuario?.id, carregandoLogin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trava novamente: prazo máximo ou inatividade
  useEffect(() => {
    if (!liberado) return undefined;

    const marcarAtividade = () => { ultimaAtividade.current = Date.now(); };
    const eventos = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    eventos.forEach((ev) => window.addEventListener(ev, marcarAtividade, { passive: true }));

    const verificar = () => {
      const d = lerDesbloqueio();
      const expirou = !d || Date.now() >= d.ate;
      const inativo = Date.now() - ultimaAtividade.current >= INATIVIDADE_MS;
      if (expirou || inativo) {
        limparDesbloqueio();
        setLiberado(false);
      }
    };
    const t = setInterval(verificar, 15000);
    // Ao voltar para a aba depois de um tempo, confere na hora
    const aoVoltar = () => { if (document.visibilityState === 'visible') verificar(); };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
      eventos.forEach((ev) => window.removeEventListener(ev, marcarAtividade));
    };
  }, [liberado]);

  const carregarStatus = useCallback(() => {
    api.get('/configuracoes/financeiro/status')
      .then((r) => setStatus(r.data))
      .catch(() => {});
  }, []);

  const desbloquear = useCallback(async (senha) => {
    const { data } = await api.post('/configuracoes/financeiro/desbloquear', { senha });
    const ate = Date.now() + (data.expiraEm || 30 * 60 * 1000);
    try { sessionStorage.setItem(CHAVE, JSON.stringify({ ate, usuarioId: usuario?.id })); } catch { /* noop */ }
    ultimaAtividade.current = Date.now();
    setLiberado(true);
    setStatus((s) => ({ ...(s || {}), usandoSenhaPadrao: data.usandoSenhaPadrao }));
    return data;
  }, [usuario?.id]);

  const bloquear = useCallback(() => {
    limparDesbloqueio();
    setLiberado(false);
  }, []);

  return (
    <FinanceiroContext.Provider value={{ liberado, status, carregarStatus, desbloquear, bloquear }}>
      {children}
    </FinanceiroContext.Provider>
  );
}

export const useFinanceiro = () => {
  const ctx = useContext(FinanceiroContext);
  if (!ctx) throw new Error('useFinanceiro deve ser usado dentro de FinanceiroProvider');
  return ctx;
};
