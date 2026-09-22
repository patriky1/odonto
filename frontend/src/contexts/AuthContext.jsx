import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const AuthContext = createContext(null);

// Aviso exibido depois do recarregamento quando outra conta entra no mesmo navegador
const CHAVE_AVISO_TROCA = 'odonto_aviso_troca_conta';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const usuarioRef = useRef(null);
  usuarioRef.current = usuario;

  useEffect(() => {
    const token = localStorage.getItem('odonto_token');
    const usuarioSalvo = localStorage.getItem('odonto_usuario');
    if (token && usuarioSalvo) {
      try { setUsuario(JSON.parse(usuarioSalvo)); } catch { /* dado corrompido: pede login de novo */ }
    }
    setLoading(false);

    try {
      const aviso = sessionStorage.getItem(CHAVE_AVISO_TROCA);
      if (aviso) {
        sessionStorage.removeItem(CHAVE_AVISO_TROCA);
        toast(aviso, { icon: '🔄', duration: 8000 });
      }
    } catch { /* noop */ }
  }, []);

  /*
   * O login fica guardado no navegador (localStorage), que é o MESMO para
   * todas as abas. Se alguém entra com outra conta em outra aba, esta aba
   * passaria a usar a conta nova "por baixo" mas continuaria mostrando a
   * antiga. Aqui a aba percebe a troca e se atualiza para a conta certa.
   * Para usar duas contas ao mesmo tempo: outro navegador, janela anônima
   * ou outro computador.
   */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== null && e.key !== 'odonto_token' && e.key !== 'odonto_usuario') return;
      const token = localStorage.getItem('odonto_token');
      let novo = null;
      try { novo = token ? JSON.parse(localStorage.getItem('odonto_usuario') || 'null') : null; } catch { novo = null; }
      const atual = usuarioRef.current;

      if (!novo) {
        if (atual) {
          setUsuario(null);
          toast('Sua sessão foi encerrada em outra aba.', { icon: '🔒' });
        }
        return;
      }
      if (!atual || atual.id !== novo.id) {
        if (atual) {
          try {
            sessionStorage.setItem(CHAVE_AVISO_TROCA,
              `A conta "${novo.nome}" entrou neste navegador, então esta aba foi atualizada para ela. ` +
              'Para usar duas contas ao mesmo tempo, use outro navegador ou uma janela anônima.');
          } catch { /* noop */ }
        }
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (email, senha) => {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('odonto_token', data.token);
    localStorage.setItem('odonto_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('odonto_token');
    localStorage.removeItem('odonto_usuario');
    setUsuario(null);
  }, []);

  const isAdmin = usuario?.perfil === 'admin';
  const isDentista = usuario?.perfil === 'dentista';
  const isRecepcionista = usuario?.perfil === 'recepcionista';
  const temPermissao = (...perfis) => perfis.includes(usuario?.perfil);

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, isAdmin, isDentista, isRecepcionista, temPermissao }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
