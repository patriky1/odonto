import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * Confirmação de exclusão em duas etapas.
 *
 * Uso:
 *   const confirmar = useConfirmacao();
 *   if (!(await confirmar({ titulo: 'Excluir paciente', item: 'Maria Souza' }))) return;
 *
 * O botão de excluir só é liberado depois que a pessoa digita a palavra
 * de confirmação (padrão: EXCLUIR). Isso evita apagar algo com um clique
 * acidental, sem precisar de senha.
 */

const ConfirmContext = createContext(null);

const PADRAO = {
  titulo: 'Confirmar exclusão',
  mensagem: '',
  item: '',
  aviso: 'Esta ação não pode ser desfeita.',
  palavra: 'EXCLUIR',
  textoBotao: 'Excluir definitivamente',
};

const normalizar = (t) => String(t || '').trim().toUpperCase();

export function ConfirmProvider({ children }) {
  const [pedido, setPedido] = useState(null);
  const [digitado, setDigitado] = useState('');
  const resolver = useRef(null);
  const inputRef = useRef(null);

  const confirmar = useCallback((opcoes = {}) => new Promise((resolve) => {
    resolver.current = resolve;
    setDigitado('');
    setPedido({ ...PADRAO, ...opcoes });
  }), []);

  const fechar = useCallback((resultado) => {
    resolver.current?.(resultado);
    resolver.current = null;
    setPedido(null);
    setDigitado('');
  }, []);

  // Esc cancela; trava a rolagem da página enquanto aberto
  useEffect(() => {
    if (!pedido) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') fechar(false); };
    document.addEventListener('keydown', onKey);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [pedido, fechar]);

  const liberado = pedido && normalizar(digitado) === normalizar(pedido.palavra);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}

      {pedido && (
        <div className="modal-overlay confirm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="confirm-titulo">
          <div className="modal confirm-modal">
            <div className="confirm-topo">
              <div className="confirm-icone"><AlertTriangle size={26} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id="confirm-titulo" className="confirm-titulo">{pedido.titulo}</h2>
                {pedido.item && <p className="confirm-item">{pedido.item}</p>}
              </div>
              <button type="button" className="confirm-fechar" onClick={() => fechar(false)} title="Cancelar">
                <X size={18} />
              </button>
            </div>

            <form
              className="modal-body"
              onSubmit={(e) => { e.preventDefault(); if (liberado) fechar(true); }}
            >
              {pedido.mensagem && <p style={{ marginBottom: 12 }}>{pedido.mensagem}</p>}
              <p className="confirm-aviso">{pedido.aviso}</p>

              <label className="form-label" htmlFor="confirm-palavra" style={{ marginTop: 16 }}>
                Para confirmar, digite <strong>{pedido.palavra}</strong> abaixo
              </label>
              <input
                id="confirm-palavra"
                ref={inputRef}
                className="form-control"
                value={digitado}
                onChange={(e) => setDigitado(e.target.value)}
                placeholder={pedido.palavra}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />

              <div className="confirm-acoes">
                <button type="button" className="btn btn-secondary" onClick={() => fechar(false)}>Cancelar</button>
                <button type="submit" className="btn btn-danger" disabled={!liberado}>
                  <Trash2 size={15} /> {pedido.textoBotao}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirmacao = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmacao deve ser usado dentro de ConfirmProvider');
  return ctx;
};
