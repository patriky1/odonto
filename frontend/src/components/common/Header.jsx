import { useState, useEffect } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function Header({ onMenuClick }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    api.get('/notificacoes/nao-lidas').then(r => setNaoLidas(r.data.count)).catch(() => {});
    const t = setInterval(() => {
      api.get('/notificacoes/nao-lidas').then(r => setNaoLidas(r.data.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <header className="app-header">
      
      <button className="menu-toggle" onClick={onMenuClick} title="Menu">
        <Menu size={22} />
      </button>

      <div className="header-date">{hoje}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          {/* <button
            onClick={() => navigate('/notificacoes')}
            style={{ width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative' }}
          >
            <Bell size={18} color="var(--text-muted)" />
            {naoLidas > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, background: 'var(--danger)', borderRadius: '50%', fontSize: 10, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </button> */}
        </div>

        <div className="header-user">
          <div style={{ fontSize: 13, fontWeight: 600 }}>{usuario?.nome?.split(' ')[0]}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{usuario?.perfil}</div>
        </div>
      </div>
    </header>
  );
}
