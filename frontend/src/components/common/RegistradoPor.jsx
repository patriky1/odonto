import { UserCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDataHoraBanco } from '../../utils/formatters';

/**
 * "Registrado por X · alterado por Y" — aparece SOMENTE para o admin.
 * Os outros perfis nem recebem esses dados do servidor.
 *
 * variante="linha"  → texto pequeno, para células de tabela
 * variante="bloco"  → caixa com datas, para modais de edição
 */
export default function RegistradoPor({ registro, variante = 'linha' }) {
  const { isAdmin } = useAuth();
  if (!isAdmin || !registro) return null;

  const { criadoPorNome, atualizadoPorNome, createdAt, updatedAt } = registro;
  if (!criadoPorNome && !atualizadoPorNome) {
    if (variante !== 'bloco') return null;
    return (
      <div className="registrado-por registrado-por-bloco">
        <UserCheck size={14} />
        <span>Registrado antes do controle de autoria — autor não identificado.</span>
      </div>
    );
  }

  const alterado = atualizadoPorNome && (atualizadoPorNome !== criadoPorNome || updatedAt !== createdAt);

  if (variante === 'bloco') {
    return (
      <div className="registrado-por registrado-por-bloco">
        <UserCheck size={14} />
        <div>
          {criadoPorNome && <div>Registrado por <strong>{criadoPorNome}</strong>{createdAt ? ` em ${formatDataHoraBanco(createdAt)}` : ''}</div>}
          {alterado && <div>Última alteração por <strong>{atualizadoPorNome}</strong>{updatedAt ? ` em ${formatDataHoraBanco(updatedAt)}` : ''}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="registrado-por" title="Visível apenas para o administrador">
      <UserCheck size={11} />
      <span>
        {criadoPorNome ? `por ${criadoPorNome}` : 'autor não identificado'}
        {alterado ? ` · alterado por ${atualizadoPorNome}` : ''}
      </span>
    </div>
  );
}
