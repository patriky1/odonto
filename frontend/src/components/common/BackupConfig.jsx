import { useEffect, useState } from 'react';
import { DatabaseBackup, Plus, RotateCcw, Trash2, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirmacao } from './ConfirmDialog';
import Modal from './Modal';
import { formatDateTime } from '../../utils/formatters';

const ROTULO_INTERVALO = {
  0: 'Desativado',
  6: 'A cada 6 horas',
  12: 'A cada 12 horas',
  24: 'Diário (a cada 24 horas)',
  168: 'Semanal',
};

const TIPO = {
  manual: { label: 'Manual', cor: 'badge-blue' },
  automatico: { label: 'Automático', cor: 'badge-gray' },
  'pre-restauracao': { label: 'Antes de restaurar', cor: 'badge-orange' },
};

const formatTamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Backup e restauração podem demorar mais que o timeout padrão da API
const LONGO = { timeout: 120000 };

/** Backup e restauração do banco de dados (somente admin). */
export default function BackupConfig() {
  const confirmar = useConfirmacao();
  const { logout } = useAuth();
  const [dados, setDados] = useState(null);
  const [cfg, setCfg] = useState({ intervaloHoras: 24, manter: 14 });
  const [ocupado, setOcupado] = useState(''); // '', 'criando', 'salvando', 'restaurando', 'excluindo'
  const [alvo, setAlvo] = useState(null);     // backup escolhido para restaurar
  const [senha, setSenha] = useState('');

  const carregar = () => api.get('/backups').then((r) => {
    setDados(r.data);
    setCfg(r.data.config);
  }).catch(() => {});
  useEffect(() => { carregar(); }, []);

  const criar = async () => {
    setOcupado('criando');
    try {
      const { data } = await api.post('/backups', null, LONGO);
      toast.success(`Backup criado (${formatTamanho(data.tamanho)})`);
      carregar();
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setOcupado('');
    }
  };

  const salvarConfig = async (e) => {
    e.preventDefault();
    setOcupado('salvando');
    try {
      await api.put('/backups/configuracao', { intervaloHoras: Number(cfg.intervaloHoras), manter: Number(cfg.manter) });
      toast.success('Configuração do backup automático salva');
      carregar();
    } catch { /* noop */ } finally {
      setOcupado('');
    }
  };

  const excluir = async (b) => {
    const ok = await confirmar({
      titulo: 'Excluir backup',
      item: `${TIPO[b.tipo]?.label || b.tipo} de ${formatDateTime(b.criadoEm)}`,
      mensagem: 'O arquivo de backup será apagado. Os dados atuais do sistema não são alterados.',
    });
    if (!ok) return;
    setOcupado('excluindo');
    try {
      await api.delete(`/backups/${encodeURIComponent(b.arquivo)}`);
      toast.success('Backup excluído');
      carregar();
    } catch { /* noop */ } finally {
      setOcupado('');
    }
  };

  const fecharModal = () => { setAlvo(null); setSenha(''); };

  const restaurar = async (e) => {
    e.preventDefault();
    if (!senha) { toast.error('Informe sua senha de acesso'); return; }
    const b = alvo;
    const senhaDigitada = senha;
    fecharModal();

    const ok = await confirmar({
      titulo: 'Restaurar backup',
      item: `${TIPO[b.tipo]?.label || b.tipo} de ${formatDateTime(b.criadoEm)}`,
      mensagem: 'Todos os dados atuais (pacientes, agenda, financeiro, usuários e configurações) serão substituídos pelos dados deste backup.',
      aviso: 'Antes de restaurar, o sistema salva automaticamente um backup do estado atual ("Antes de restaurar").',
      palavra: 'RESTAURAR',
      textoBotao: 'Restaurar backup',
      icone: RotateCcw,
    });
    if (!ok) return;

    setOcupado('restaurando');
    const aviso = toast.loading('Restaurando backup... não feche esta página.');
    try {
      await api.post(`/backups/${encodeURIComponent(b.arquivo)}/restaurar`, { senha: senhaDigitada }, LONGO);
      toast.success('Backup restaurado com sucesso. Entre novamente no sistema.', { duration: 8000 });
      logout(); // os usuários podem ter mudado junto com o backup
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      toast.dismiss(aviso);
      setOcupado('');
    }
  };

  const backups = dados?.backups || [];

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h3 className="card-title"><DatabaseBackup size={16} style={{ display: 'inline', marginRight: 6 }} />Backup do banco de dados</h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={criar} disabled={!!ocupado}>
          <Plus size={15} /> {ocupado === 'criando' ? 'Gerando backup...' : 'Fazer backup agora'}
        </button>
      </div>

      <p className="text-sm text-muted mb-4">
        Cópias completas do banco (pacientes, agenda, prontuários, financeiro, usuários e configurações).
        As fotos e imagens enviadas não fazem parte do backup.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fef3c7', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
        <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, color: '#92400e' }}>
          Os backups ficam neste computador{dados?.pasta && <> (<code style={{ wordBreak: 'break-all' }}>{dados.pasta}</code>)</>}.
          Para se proteger de defeito no disco ou perda do equipamento, copie essa pasta periodicamente para um pendrive,
          HD externo ou nuvem.
        </span>
      </div>

      {/* Backup automático */}
      <form onSubmit={salvarConfig} style={{ maxWidth: 620, marginBottom: 20 }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="bkp-intervalo">Backup automático</label>
            <select id="bkp-intervalo" className="form-control" value={cfg.intervaloHoras}
              onChange={(e) => setCfg((c) => ({ ...c, intervaloHoras: e.target.value }))}>
              {(dados?.intervalosHoras || Object.keys(ROTULO_INTERVALO).map(Number)).map((h) => (
                <option key={h} value={h}>{ROTULO_INTERVALO[h] || `A cada ${h} horas`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="bkp-manter">Manter os últimos (automáticos)</label>
            <input id="bkp-manter" type="number" min={1} max={100} className="form-control" value={cfg.manter}
              onChange={(e) => setCfg((c) => ({ ...c, manter: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-secondary" disabled={!!ocupado}>
            <Save size={15} /> {ocupado === 'salvando' ? 'Salvando...' : 'Salvar configuração'}
          </button>
          {dados && (
            <span className="text-sm text-muted">
              Último automático: {dados.ultimoAutomatico ? formatDateTime(dados.ultimoAutomatico) : 'nenhum'}
              {' · '}
              Próximo: {dados.proximoAutomatico ? formatDateTime(dados.proximoAutomatico) : 'desativado'}
            </span>
          )}
        </div>
        <p className="text-xs text-muted" style={{ marginTop: 8 }}>
          Backups manuais e os feitos antes de uma restauração nunca são apagados automaticamente.
        </p>
      </form>

      {/* Lista */}
      {!dados ? (
        <div className="loading"><div className="spinner" /></div>
      ) : backups.length === 0 ? (
        <p className="text-sm text-muted">Nenhum backup criado ainda.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table table-cards">
            <thead>
              <tr><th>Data / hora</th><th>Tipo</th><th>Tamanho</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.arquivo}>
                  <td className="td-titulo" style={{ whiteSpace: 'nowrap', fontWeight: 600 }} title={b.arquivo}>{formatDateTime(b.criadoEm)}</td>
                  <td data-label="Tipo"><span className={`badge ${TIPO[b.tipo]?.cor || 'badge-gray'}`}>{TIPO[b.tipo]?.label || b.tipo}</span></td>
                  <td data-label="Tamanho">{formatTamanho(b.tamanho)}</td>
                  <td data-label="Ações" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAlvo(b)} disabled={!!ocupado}>
                      <RotateCcw size={14} /> Restaurar
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }}
                      onClick={() => excluir(b)} disabled={!!ocupado} title="Excluir backup">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!alvo} onClose={fecharModal} title="Restaurar backup"
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={fecharModal}>Cancelar</button>
            <button type="submit" form="form-restaurar" className="btn btn-danger" disabled={!senha}>
              <RotateCcw size={15} /> Continuar
            </button>
          </>
        )}>
        {alvo && (
          <form id="form-restaurar" onSubmit={restaurar}>
            <p style={{ marginBottom: 12 }}>
              Backup <strong>{TIPO[alvo.tipo]?.label || alvo.tipo}</strong> de <strong>{formatDateTime(alvo.criadoEm)}</strong> ({formatTamanho(alvo.tamanho)}).
            </p>
            <ul className="text-sm" style={{ margin: '0 0 16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Tudo o que foi registrado depois dessa data deixará de aparecer no sistema.</li>
              <li>Um backup do estado atual é criado antes, para poder desfazer.</li>
              <li>Ao terminar, você precisará entrar novamente.</li>
            </ul>
            <div className="form-group">
              <label className="form-label" htmlFor="bkp-senha">Sua senha de acesso (login)</label>
              <input id="bkp-senha" type="password" className="form-control" value={senha} autoFocus
                onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
