import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, Menu } from 'lucide-react';

/**
 * Barra de navegação inferior — aparece só no celular (ver global.css).
 * Deixa os atalhos mais usados ao alcance do polegar; o restante
 * continua no menu lateral (botão "Menu").
 */
const ITENS = [
  { to: '/dashboard', icon: Home, label: 'Início' },
  { to: '/pacientes', icon: Users, label: 'Pacientes' },
  { to: '/prontuarios', icon: FileText, label: 'Prontuários' },
];

export default function BottomNav({ onMenuClick }) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {ITENS.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `bottom-nav-item${isActive ? ' ativo' : ''}`}>
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button type="button" className="bottom-nav-item" onClick={onMenuClick}>
        <Menu size={22} />
        <span>Menu</span>
      </button>
    </nav>
  );
}
