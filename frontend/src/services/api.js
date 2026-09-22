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

    if (error.response?.status === 401) {
      localStorage.removeItem('odonto_token');
      localStorage.removeItem('odonto_usuario');
      window.location.href = '/login';
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
