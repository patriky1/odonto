import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Calendar, UserCog, FileText, Stethoscope,
  Smile, DollarSign, Settings, LogOut, ClipboardList, Activity, X, ShieldCheck
} from 'lucide-react';
import Logo from '../image/Logo.png';
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/pacientes', icon: Users, label: 'Pacientes' },
  { to: '/dentistas', icon: Stethoscope, label: 'Dentistas' },
  { to: '/prontuarios', icon: FileText, label: 'Prontuários' },
  { to: '/odontograma', icon: Smile, label: 'Odontograma' },
  { to: '/tratamentos', icon: Activity, label: 'Tratamentos' },
  { to: '/procedimentos', icon: ClipboardList, label: 'Procedimentos' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/usuarios', icon: UserCog, label: 'Usuários', adminOnly: true },
  { to: '/auditoria', icon: ShieldCheck, label: 'Registro de atividades', adminOnly: true },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

export default function Sidebar({ open, onClose }) {
  const { usuario, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNav = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 769) onClose?.();
  };

  const initials = usuario?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
  const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
  const avatarColor = colors[usuario?.id % colors.length] || colors[0];

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      {/* Logo + close btn (mobile) */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 200, height: 106, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={Logo} alt="Logo" style={{ width: 200, height: 120 }} />
          </div>
          {/* <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Dr. Murilo Abrantes</div>
            <div style={{ color: 'var(--sidebar-text)', fontSize: 11, marginTop: 2 }}>Gestão Odontológica</div>
          </div> */}
        </div>
        <button className="sidebar-close-btn" onClick={onClose} title="Fechar menu">
          <X size={18} color="var(--sidebar-text)" />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {navItems.map(({ to, icon: Icon, label, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={handleNav}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                color: isActive ? '#fff' : 'var(--sidebar-text)',
                background: isActive ? 'var(--primary)' : 'transparent',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              })}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(253, 253, 253, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, marginBottom: 4 }}>
          <div className="avatar" style={{ background: avatarColor, width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usuario?.nome}</div>
            <div style={{ color: '#fff', fontSize: 11, textTransform: 'capitalize' }}>{usuario?.perfil}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--sidebar-text)', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.15)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </aside>
  );
}
