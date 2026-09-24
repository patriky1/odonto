import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * O odontograma agora é a aba "Orçamento" da ficha do paciente.
 * Este endereço antigo (/odontograma?paciente=ID) só redireciona,
 * para não quebrar links e favoritos já salvos.
 */
export default function OdontogramaPage() {
  const [searchParams] = useSearchParams();
  const pacienteId = searchParams.get('paciente');
  return <Navigate to={pacienteId ? `/pacientes/${pacienteId}?aba=orcamento` : '/pacientes'} replace />;
}
