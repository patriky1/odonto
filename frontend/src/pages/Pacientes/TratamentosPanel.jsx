import { useState, useEffect, useCallback } from 'react';
import { Plus, Activity, Pencil, Trash2, Images } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import RegistradoPor from '../../components/common/RegistradoPor';
import { useConfirmacao } from '../../components/common/ConfirmDialog';
import TratamentoForm, { textoTratamento } from '../../components/tratamentos/TratamentoForm';
import GaleriaImagens from '../../components/tratamentos/GaleriaImagens';
import { formatDataHoraBanco } from '../../utils/formatters';

/**
 * Tratamentos do paciente (aba da ficha): vários por paciente, cada um com
 * uma descrição e uma galeria de até 10 imagens.
 */
export default function TratamentosPanel({ pacienteId }) {
  const confirmar = useConfirmacao();
  const [tratamentos, setTratamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {} = novo | tratamento = edição
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/tratamentos', { params: { pacienteId } })
      .then((r) => setTratamentos(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (dados) => {
    if (!dados.descricao) return toast.error('Descreva o tratamento');
    setSalvando(true);
    try {
      if (modal?.id) {
        await api.put(`/tratamentos/${modal.id}`, { descricao: dados.descricao, imagens: dados.imagens });
        toast.success('Tratamento atualizado');
      } else {
        await api.post('/tratamentos', { pacienteId, descricao: dados.descricao, imagens: dados.imagens });
        toast.success('Tratamento cadastrado');
      }
      setModal(null);
      carregar();
    } catch { /* mensagem já exibida pelo interceptor */ } finally {
      setSalvando(false);
    }
  };

  const excluir = async (t) => {
    const ok = await confirmar({
      titulo: 'Excluir tratamento',
      item: t.nome,
      mensagem: 'As imagens da galeria deste tratamento também serão apagadas.',
    });
    if (!ok) return;
    try {
      await api.delete(`/tratamentos/${t.id}`);
      toast.success('Tratamento excluído');
      carregar();
    } catch { /* noop */ }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: 12 }}>
        <h3 className="card-title">Tratamentos</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}><Plus size={14} /> Novo tratamento</button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : tratamentos.length === 0 ? (
        <div className="empty-state">
          <Activity size={40} />
          <h3>Nenhum tratamento registrado</h3>
          <p className="text-sm text-muted">Clique em “Novo tratamento” para descrever o tratamento e anexar as imagens.</p>
        </div>
      ) : (
        tratamentos.map((t) => (
          <div key={t.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="text-xs text-muted" style={{ marginBottom: 4 }}>
                  {formatDataHoraBanco(t.createdAt)}
                  {t.imagens.length > 0 && <> · <Images size={12} style={{ verticalAlign: -2 }} /> {t.imagens.length} imagem(ns)</>}
                </p>
                <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>{textoTratamento(t)}</p>
                <RegistradoPor registro={t} />
              </div>
              <div className="actions" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => setModal(t)}><Pencil size={15} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" title="Excluir" style={{ color: 'var(--danger)' }} onClick={() => excluir(t)}><Trash2 size={15} /></button>
              </div>
            </div>
            {t.imagens.length > 0 && <div style={{ marginTop: 10 }}><GaleriaImagens imagens={t.imagens} /></div>}
          </div>
        ))
      )}

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} size="lg"
        title={modal?.id ? 'Editar tratamento' : 'Novo tratamento'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary" form="form-tratamento-paciente" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        )}>
        {modal && (
          <>
            {modal.id && <RegistradoPor registro={modal} variante="bloco" />}
            <TratamentoForm key={modal.id || 'novo'} id="form-tratamento-paciente" tratamento={modal.id ? modal : null} onSubmit={salvar} />
          </>
        )}
      </Modal>
    </div>
  );
}
