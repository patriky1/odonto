import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceiro, INATIVIDADE_MIN } from '../contexts/FinanceiroContext';
import SalasConfig from '../components/common/SalasConfig';
import DadosEmpresaConfig from '../components/common/DadosEmpresaConfig';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Settings, Lock, User, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function ConfiguracoesPage() {
  const { usuario, isAdmin } = useAuth();
  const { status, carregarStatus, bloquear } = useFinanceiro();
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const [loading, setLoading] = useState(false);
  const [finForm, setFinForm] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const [salvandoFin, setSalvandoFin] = useState(false);

  useEffect(() => { carregarStatus(); }, [carregarStatus]);

  const handleSenhaFinanceira = async (e) => {
    e.preventDefault();
    if (finForm.novaSenha !== finForm.confirmar) { toast.error('As senhas não coincidem'); return; }
    if (finForm.novaSenha.length < 4) { toast.error('A senha deve ter pelo menos 4 caracteres'); return; }
    setSalvandoFin(true);
    try {
      await api.put('/configuracoes/financeiro/senha', {
        senhaAtual: finForm.senhaAtual,
        novaSenha: finForm.novaSenha,
      });
      toast.success('Senha financeira alterada!');
      setFinForm({ senhaAtual: '', novaSenha: '', confirmar: '' });
      bloquear(); // exige a nova senha na próxima visualização
      carregarStatus();
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setSalvandoFin(false);
    }
  };

  const handleSenha = async (e) => {
    e.preventDefault();
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      toast.error('As senhas não coincidem'); return;
    }
    if (senhaForm.novaSenha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres'); return;
    }
    setLoading(true);
    try {
      await api.put('/auth/alterar-senha', { senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha });
      toast.success('Senha alterada com sucesso!');
      setSenhaForm({ senhaAtual: '', novaSenha: '', confirmar: '' });
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Configurações</h1><p>Gerenciar preferências da conta</p></div>
      </div>

      <div className="grid-2">
        {/* Perfil */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><User size={16} style={{ display: 'inline', marginRight: 6 }} />Meu Perfil</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Nome', value: usuario?.nome },
              { label: 'E-mail', value: usuario?.email },
              { label: 'Perfil de Acesso', value: { admin: 'Administrador', dentista: 'Dentista', recepcionista: 'Recepcionista' }[usuario?.perfil] },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</p>
                <p style={{ fontWeight: 500, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alterar senha */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Lock size={16} style={{ display: 'inline', marginRight: 6 }} />Alterar Senha</h3>
          </div>
          <form onSubmit={handleSenha}>
            <div className="form-group">
              <label className="form-label">Senha Atual</label>
              <input type="password" className="form-control" value={senhaForm.senhaAtual} onChange={e => setSenhaForm(f => ({ ...f, senhaAtual: e.target.value }))} required placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label className="form-label">Nova Senha</label>
              <input type="password" className="form-control" value={senhaForm.novaSenha} onChange={e => setSenhaForm(f => ({ ...f, novaSenha: e.target.value }))} required placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar Nova Senha</label>
              <input type="password" className="form-control" value={senhaForm.confirmar} onChange={e => setSenhaForm(f => ({ ...f, confirmar: e.target.value }))} required placeholder="Repita a nova senha" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Alterando...' : 'Alterar Senha'}</button>
          </form>
        </div>
      </div>

      {/* Senha do financeiro — somente admin */}
      {isAdmin && (
        <div className="card mt-4">
          <div className="card-header">
            <h3 className="card-title"><ShieldCheck size={16} style={{ display: 'inline', marginRight: 6 }} />Senha do Financeiro</h3>
          </div>

          <p className="text-sm text-muted mb-4">
            Esta senha libera a exibição do faturamento, dos gastos e do resultado da clínica.
            Ela é independente da senha de login. Os valores voltam a ficar ocultos sozinhos ao sair do sistema,
            ao entrar com outra conta, após {INATIVIDADE_MIN} minutos sem uso ou, no máximo, 30 minutos depois de liberados.
          </p>

          {status?.usandoSenhaPadrao && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fef3c7', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#92400e' }}>
                A senha financeira ainda é a padrão (<strong>123456</strong>). Altere agora para proteger os valores.
              </span>
            </div>
          )}

          <form onSubmit={handleSenhaFinanceira} style={{ maxWidth: 520 }}>
            <div className="form-group">
              <label className="form-label">Senha financeira atual</label>
              <input type="password" className="form-control" value={finForm.senhaAtual}
                onChange={e => setFinForm(f => ({ ...f, senhaAtual: e.target.value }))}
                required placeholder={status?.usandoSenhaPadrao ? '123456' : '••••••'} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nova senha financeira</label>
                <input type="password" className="form-control" value={finForm.novaSenha}
                  onChange={e => setFinForm(f => ({ ...f, novaSenha: e.target.value }))}
                  required minLength={4} placeholder="Mínimo 4 caracteres" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar nova senha</label>
                <input type="password" className="form-control" value={finForm.confirmar}
                  onChange={e => setFinForm(f => ({ ...f, confirmar: e.target.value }))}
                  required placeholder="Repita a nova senha" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={salvandoFin}>
              {salvandoFin ? 'Alterando...' : 'Alterar senha financeira'}
            </button>
          </form>
        </div>
      )}

      {isAdmin && <DadosEmpresaConfig />}

      {isAdmin && <SalasConfig />}

      {/* Info sistema */}
      <div className="card mt-4">
        <div className="card-header"><h3 className="card-title"><Settings size={16} style={{ display: 'inline', marginRight: 6 }} />Sobre o Sistema</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Desenvolvido por:', value: 'Brito Soluções em TI' },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
              <p className="text-muted text-sm">{label}</p>
              <p style={{ fontWeight: 600, marginTop: 4 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
