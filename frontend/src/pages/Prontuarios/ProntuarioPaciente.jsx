import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import api from '../../services/api';
import ProntuarioAutomatico from '../../components/prontuario/ProntuarioAutomatico';
import LinkPaciente from '../../components/common/LinkPaciente';
import { AvatarPaciente } from '../../components/common/FotoPaciente';
import { calcularIdade, formatCPF } from '../../utils/formatters';

/** Página do prontuário de um paciente (/prontuarios/:pacienteId). */
export default function ProntuarioPaciente() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState(null);

  useEffect(() => {
    api.get(`/pacientes/${pacienteId}`).then((r) => setPaciente(r.data)).catch(() => setPaciente(false));
  }, [pacienteId]);

  if (paciente === false) return <div className="empty-state"><h3>Paciente não encontrado</h3></div>;

  return (
    <div>
      <div className="perfil-topo">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/prontuarios')} title="Voltar para os prontuários">
          <ArrowLeft size={18} />
        </button>
        {paciente && <AvatarPaciente paciente={paciente} tamanho={44} fonte={15} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, wordBreak: 'break-word' }}>
            Prontuário de {paciente ? <LinkPaciente id={paciente.id} nome={paciente.nome} /> : '…'}
          </h1>
          {paciente && (
            <p className="text-muted text-sm">
              {[paciente.dataNascimento && `${calcularIdade(paciente.dataNascimento)} anos`, paciente.cpf && `CPF ${formatCPF(paciente.cpf)}`]
                .filter(Boolean).join(' — ') || 'Dados pessoais incompletos'}
            </p>
          )}
        </div>
        <div className="perfil-topo-acoes">
          <button className="btn btn-secondary" onClick={() => navigate(`/pacientes/${pacienteId}`)}><User size={16} /> Ficha do paciente</button>
        </div>
      </div>
      <ProntuarioAutomatico pacienteId={pacienteId} />
    </div>
  );
}
