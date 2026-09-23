import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Request interceptor - adiciona token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('odonto_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Rotas em que 401 quer dizer "senha incorreta", e NÃO "sessão expirada"
const ROTAS_SENHA = [
  '/auth/login',
  '/auth/esqueci-senha',
  '/auth/redefinir-senha',
  '/configuracoes/financeiro/desbloquear',
];

// Response interceptor - trata erros globalmente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // O backend responde ora com { error }, ora com { erro } — tratamos os dois
    const dados = error.response?.data;
    const msg =
      dados?.error ||
      dados?.erro ||
      dados?.mensagem ||
      (error.code === 'ECONNABORTED'
        ? 'O servidor demorou para responder. Tente novamente.'
        : 'Erro de conexão com o servidor');

    // 401 = sessão inválida/expirada -> volta para o login.
    // Exceção: rotas onde 401 significa só "senha digitada errada" (login e
    // senha do financeiro). Nelas o usuário continua onde está e vê o erro.
    const url = error.config?.url || '';
    const rotaDeSenha = ROTAS_SENHA.some((r) => url.startsWith(r));

    if (error.response?.status === 401 && !rotaDeSenha) {
      localStorage.removeItem('odonto_token');
      localStorage.removeItem('odonto_usuario');
      // Evita recarregar a tela de login (apagaria o que foi digitado)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      error.mensagem = msg;
      return Promise.reject(error);
    }

    if (error.response?.status !== 404) {
      toast.error(msg);
    }

    error.mensagem = msg;
    return Promise.reject(error);
  }
);

export default api;
