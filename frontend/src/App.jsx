import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FinanceiroProvider } from './contexts/FinanceiroContext';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import Login from './pages/Login';
import RedefinirSenha from './pages/RedefinirSenha';
import Dashboard from './pages/Dashboard';
import PacientesList from './pages/Pacientes/PacientesList';
import PacienteDetalhes from './pages/Pacientes/PacienteDetalhes';
import DentistasList from './pages/Dentistas/DentistasList';
import AgendaPage from './pages/Agenda/AgendaPage';
import TratamentosList from './pages/Tratamentos/TratamentosList';
import ProcedimentosList from './pages/Procedimentos/ProcedimentosList';
import ProntuariosList from './pages/Prontuarios/ProntuariosList';
import ProntuarioPaciente from './pages/Prontuarios/ProntuarioPaciente';
import AuditoriaPage from './pages/Auditoria/AuditoriaPage';
import FinanceiroPage from './pages/Financeiro/FinanceiroPage';
import UsuariosList from './pages/Usuarios/UsuariosList';
import OdontogramaPage from './pages/OdontogramaPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';

function PrivateRoute({ children }) {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  return usuario ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  return !usuario ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><AuthLayout><Login /></AuthLayout></PublicRoute>} />
      {/* Link recebido por e-mail — funciona com ou sem alguém logado */}
      <Route path="/redefinir-senha" element={<AuthLayout><RedefinirSenha /></AuthLayout>} />

      <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pacientes" element={<PacientesList />} />
        <Route path="/pacientes/:id" element={<PacienteDetalhes />} />
        <Route path="/dentistas" element={<DentistasList />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/tratamentos" element={<TratamentosList />} />
        <Route path="/procedimentos" element={<ProcedimentosList />} />
        <Route path="/prontuarios" element={<ProntuariosList />} />
        <Route path="/prontuarios/:pacienteId" element={<ProntuarioPaciente />} />
        <Route path="/auditoria" element={<AuditoriaPage />} />
        <Route path="/odontograma" element={<OdontogramaPage />} />
        <Route path="/financeiro" element={<FinanceiroPage />} />
        <Route path="/usuarios" element={<UsuariosList />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceiroProvider>
        <ConfirmProvider>
          <AppRoutes />
        </ConfirmProvider>
      </FinanceiroProvider>
    </AuthProvider>
  );
}
