import { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import Modal from './Modal';
import toast from 'react-hot-toast';
import { useFinanceiro } from '../../contexts/FinanceiroContext';

/**
 * Exibe um valor financeiro apenas quando o financeiro está desbloqueado.
 * Enquanto travado, mostra um marcador no lugar do número.
 */
export function ValorProtegido({ children, marcador = '••••••', className, style }) {
  const { liberado } = useFinanceiro();
  if (liberado) return <span className={className} style={style}>{children}</span>;
  return (
    <span
      className={className}
      style={{ ...style, letterSpacing: 1, color: 'var(--text-muted)' }}
      title="Valor protegido — clique em Mostrar valores"
    >
      {marcador}
    </span>
  );
}

/** Esconde um bloco inteiro (gráficos, tabelas) atrás de um aviso de proteção. */
export function BlocoProtegido({ children, altura = 200, onDesbloquear }) {
  const { liberado } = useFinanceiro();
  if (liberado) return children;

  return (
    <div
      style={{
        minHeight: altura,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: 'var(--bg)',
        borderRadius: 10,
        border: '1px dashed var(--border)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <Lock size={26} color="var(--text-muted)" />
      <p className="text-sm text-muted" style={{ maxWidth: 320 }}>
        Informações financeiras protegidas. Informe a senha para visualizar.
      </p>
      {onDesbloquear && (
        <button className="btn btn-primary btn-sm" onClick={onDesbloquear}>
          <Unlock size={14} /> Mostrar valores
        </button>
      )}
    </div>
  );
}

/** Botão de cadeado + modal de senha. */
export function BotaoDesbloqueio({ aberto, onAbrir, onFechar }) {
  const { liberado, status, desbloquear, bloquear } = useFinanceiro();
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async (e) => {
    e?.preventDefault();
    if (!senha) return;
    setEnviando(true);
    try {
      const r = await desbloquear(senha);
      setSenha('');
      onFechar();
      toast.success('Valores liberados');
      if (r.usandoSenhaPadrao) {
        toast('A senha financeira ainda é a padrão. Altere em Configurações.', { icon: '⚠️', duration: 6000 });
      }
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {liberado ? (
        <button className="btn btn-secondary" onClick={bloquear} title="Ocultar valores novamente">
          <EyeOff size={16} /> Ocultar valores
        </button>
      ) : (
        <button className="btn btn-primary" onClick={onAbrir}>
          <Eye size={16} /> Mostrar valores
        </button>
      )}

      <Modal
        open={aberto}
        onClose={() => { setSenha(''); onFechar(); }}
        title="Acesso às informações financeiras"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setSenha(''); onFechar(); }}>Cancelar</button>
            <button className="btn btn-primary" form="form-senha-financeira" type="submit" disabled={enviando}>
              <Unlock size={15} /> {enviando ? 'Verificando...' : 'Liberar'}
            </button>
          </>
        }
      >
        <form id="form-senha-financeira" onSubmit={confirmar}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <ShieldAlert size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm text-muted">
              Faturamento, lucro e demais valores da clínica ficam ocultos por padrão.
              Informe a senha financeira para exibi-los nesta sessão.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Senha financeira</label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrar ? 'text' : 'password'}
                className="form-control"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite a senha"
                autoFocus
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setMostrar((m) => !m)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
                }}
                title={mostrar ? 'Ocultar' : 'Mostrar'}
              >
                {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {status?.usandoSenhaPadrao && (
            <p className="text-xs" style={{ color: 'var(--warning)' }}>
              A senha padrão ainda está ativa (<strong>123456</strong>). Altere em Configurações.
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
