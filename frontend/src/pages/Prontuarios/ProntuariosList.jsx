import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, ClipboardCheck } from 'lucide-react';
import api from '../../services/api';
import LinkPaciente from '../../components/common/LinkPaciente';
import { AvatarPaciente } from '../../components/common/FotoPaciente';
import { formatDate, calcularIdade } from '../../utils/formatters';

/**
 * Prontuários: um por paciente, montado automaticamente.
 * A lista mostra o resumo e leva ao prontuário completo.
 */
export default function ProntuariosList() {
  const navigate = useNavigate();
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [soComRegistros, setSoComRegistros] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get('/prontuarios/pacientes', { params: { busca: busca || undefined } })
        .then((r) => setPacientes(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  const temRegistro = (p) => p.atendimentos || p.tratamentos || p.marcacoesOdontograma || p.anotacoes || p.temAnamnese;
  const lista = soComRegistros ? pacientes.filter(temRegistro) : pacientes;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Prontuários</h1>
          <p>Gerados automaticamente com os atendimentos, tratamentos e odontograma de cada paciente</p>
        </div>
      </div>

      <div className="card">
        <div className="search-bar" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="search-input" style={{ flex: 1, minWidth: 220 }}>
            <Search size={16} className="search-icon" />
            <input className="form-control" placeholder="Buscar paciente por nome ou CPF..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={soComRegistros} onChange={(e) => setSoComRegistros(e.target.checked)} />
            Só pacientes com registros clínicos
          </label>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table className="table table-cards">
              <thead>
                <tr><th>Paciente</th><th>Último atendimento</th><th>Atendimentos</th><th>Tratamentos</th><th>Odontograma</th><th>Anamnese</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="clicavel" onClick={() => navigate(`/prontuarios/${p.id}`)}>
                    <td className="td-titulo">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AvatarPaciente paciente={p} tamanho={34} fonte={12} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}><LinkPaciente id={p.id} nome={p.nome} /></div>
                          {p.dataNascimento && <div className="text-xs text-muted">{calcularIdade(p.dataNascimento)} anos</div>}
                        </div>
                      </div>
                    </td>
                    <td data-label="Último atendimento">{p.ultimoAtendimento ? formatDate(p.ultimoAtendimento) : '—'}</td>
                    <td data-label="Atendimentos">{p.atendimentos}</td>
                    <td data-label="Tratamentos">
                      {p.tratamentos}
                      {p.tratamentosAtivos > 0 && <span className="badge badge-warning" style={{ marginLeft: 6 }}>{p.tratamentosAtivos} em aberto</span>}
                    </td>
                    <td data-label="Odontograma">{p.marcacoesOdontograma ? `${p.marcacoesOdontograma} marcação(ões)` : '—'}</td>
                    <td data-label="Anamnese">
                      {p.temAnamnese ? <span className="badge badge-success">Preenchida</span> : <span className="badge badge-gray">Pendente</span>}
                    </td>
                    <td className="td-acoes">
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/prontuarios/${p.id}`); }}>
                        <ClipboardCheck size={14} /> Abrir prontuário
                      </button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <FileText size={40} />
                      <h3>{busca ? 'Nenhum paciente encontrado' : 'Nenhum prontuário com registros ainda'}</h3>
                      <p className="text-sm text-muted">
                        Conclua atendimentos na agenda, cadastre tratamentos ou marque o odontograma: o prontuário se monta sozinho.
                      </p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
