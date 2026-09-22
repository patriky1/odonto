import { Link } from 'react-router-dom';

/**
 * Nome do paciente sempre levando ao perfil dele.
 * Use em qualquer lista, cartão ou tabela que mostre o nome.
 *
 * Dentro de linhas/cartões clicáveis, o clique no nome não dispara
 * o clique do contêiner (abre o perfil em vez de, p. ex., editar).
 */
export default function LinkPaciente({ id, nome, className = '', style, children, title }) {
  const texto = children ?? nome ?? '—';
  if (!id) return <span className={className} style={style}>{texto}</span>;
  return (
    <Link
      to={`/pacientes/${id}`}
      className={`link-paciente ${className}`.trim()}
      style={style}
      title={title || `Abrir perfil de ${nome || 'paciente'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {texto}
    </Link>
  );
}
