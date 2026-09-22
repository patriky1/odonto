import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

/** Tela aberta pelo link de "Esqueci minha senha". */
export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [estado, setEstado] = useState('verificando'); // verificando | valido | invalido | concluido
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) { setEstado('invalido'); return; }
    api.get(`/auth/redefinir-senha/${token}`)
      .then((r) => { setNome(r.data.nome); setEstado('valido'); })
      .catch(() => setEstado('invalido'));
  }, [token]);

  const salvar = async (e) => {
    e.preventDefault();
    if (senha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    if (senha !== confirmar) { toast.error('As senhas não coincidem'); return; }
    setEnviando(true);
    try {
      await api.post('/auth/redefinir-senha', { token, novaSenha: senha });
      setEstado('concluido');
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setEnviando(false);
    }
  };

  const cartao = { background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,.4)', width: '100%', maxWidth: 420 };

  if (estado === 'verificando') {
    return <div style={cartao}><div className="loading"><div className="spinner" /></div></div>;
  }

  if (estado === 'invalido') {
    return (
      <div style={cartao}>
        <AlertTriangle size={32} color="var(--warning)" />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Link inválido ou expirado</h2>
        <p className="text-muted" style={{ margin: '8px 0 24px' }}>
          O link de redefinição vale por 1 hora e só pode ser usado uma vez. Peça um novo na tela de login.
        </p>
        <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Voltar ao login</Link>
      </div>
    );
  }

  if (estado === 'concluido') {
    return (
      <div style={cartao}>
        <CheckCircle size={32} color="var(--success)" />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Senha alterada</h2>
        <p className="text-muted" style={{ margin: '8px 0 24px' }}>Agora é só entrar com a nova senha.</p>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => navigate('/login')}>
          Ir para o login
        </button>
      </div>
    );
  }

  return (
    <div style={cartao}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Criar nova senha</h2>
      <p className="text-muted" style={{ fontSize: 14, marginBottom: 24 }}>Olá, {nome}! Escolha uma senha com pelo menos 6 caracteres.</p>
      <form onSubmit={salvar}>
        <div className="form-group">
          <label className="form-label" htmlFor="nova-senha">Nova senha</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input id="nova-senha" type={mostrar ? 'text' : 'password'} className="form-control" style={{ paddingLeft: 36, paddingRight: 40 }}
              value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoFocus autoComplete="new-password" />
            <button type="button" onClick={() => setMostrar((m) => !m)} title={mostrar ? 'Ocultar' : 'Mostrar'}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="confirmar-senha">Repita a nova senha</label>
          <input id="confirmar-senha" type={mostrar ? 'text' : 'password'} className="form-control"
            value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required autoComplete="new-password" />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={enviando}>
          {enviando ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}
