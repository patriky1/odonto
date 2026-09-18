import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/common/Modal';
import Logo from '../components/image/Logo.png';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [respostaRecuperacao, setRespostaRecuperacao] = useState('');

  const abrirEsqueci = () => {
    setEmailRecuperacao(form.email);
    setRespostaRecuperacao('');
    setEsqueci(true);
  };

  const pedirRecuperacao = async (e) => {
    e.preventDefault();
    setEnviandoRecuperacao(true);
    try {
      const { data } = await api.post('/auth/esqueci-senha', { email: emailRecuperacao });
      setRespostaRecuperacao(data.mensagem);
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setEnviandoRecuperacao(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.senha);
      navigate('/dashboard');
    } catch {
      // Erro tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 3 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 80px', marginTop: 20 }}>
          <img src={Logo} alt="Logo" style={{ width: 320, height: 200 }} />
        </div>
      
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,.4)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>Bem-vindo de volta</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>Entre com suas credenciais para continuar</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="form-control"
                style={{ paddingLeft: 36 }}
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showSenha ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                placeholder="••••••••"
                value={form.senha}
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShowSenha(!showSenha)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, marginTop: 8 }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <button type="button" onClick={abrirEsqueci} className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12, color: 'var(--primary)' }}>
          Esqueci minha senha
        </button>

        {/* <div style={{ marginTop: 20, padding: 16, background: 'var(--bg)', borderRadius: 10, fontSize: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>Usuários de teste:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { perfil: 'Admin', email: 'admin@odonto.com' },
              { perfil: 'Dentista', email: 'dentista@odonto.com' },
              { perfil: 'Recepção', email: 'recepcao@odonto.com' },
            ].map(u => (
              <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 600 }}>{u.perfil}:</span>
                <span>{u.email} / <strong>123456</strong></span>
              </div>
            ))}
          </div>
        </div> */}
      </div>

      <Modal
        open={esqueci}
        onClose={() => setEsqueci(false)}
        title="Recuperar senha"
        footer={respostaRecuperacao ? (
          <button className="btn btn-primary" onClick={() => setEsqueci(false)}>Entendi</button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => setEsqueci(false)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-recuperar" disabled={enviandoRecuperacao}>
              {enviandoRecuperacao ? 'Enviando...' : 'Enviar instruções'}
            </button>
          </>
        )}
      >
        {respostaRecuperacao ? (
          <p style={{ fontSize: 14 }}>{respostaRecuperacao}</p>
        ) : (
          <form id="form-recuperar" onSubmit={pedirRecuperacao}>
            <p className="text-sm text-muted mb-4">
              Informe o e-mail que você usa para entrar. Enviaremos um link para criar uma nova senha.
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="email-recuperacao">E-mail</label>
              <input id="email-recuperacao" type="email" className="form-control" required autoFocus
                value={emailRecuperacao} onChange={(e) => setEmailRecuperacao(e.target.value)} placeholder="seu@email.com" />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
