import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import GaleriaUpload from './GaleriaUpload';

/**
 * Texto completo do tratamento. Os novos guardam tudo na descrição (o nome
 * é a primeira linha dela); nos antigos, nome e descrição eram campos
 * separados — aqui eles são juntados para nada se perder.
 */
export const textoTratamento = (t) => {
  if (!t) return '';
  const descricao = t.descricao || '';
  const nome = String(t.nome || '').replace(/\.\.\.$/, '');
  if (!nome || descricao.startsWith(nome)) return descricao || t.nome || '';
  return descricao ? `${t.nome}\n\n${descricao}` : t.nome;
};

/**
 * Formulário do tratamento: só a descrição e a galeria de imagens.
 * Quando `pacientes` é informado (tela geral de Tratamentos), mostra
 * também a escolha do paciente; na ficha do paciente ela não aparece.
 */
export default function TratamentoForm({ id = 'form-tratamento', tratamento, pacientes, onSubmit }) {
  const [form, setForm] = useState(() => ({
    pacienteId: tratamento?.pacienteId || '',
    descricao: textoTratamento(tratamento),
    imagens: tratamento?.imagens || [],
  }));
  const [buscaPaciente, setBuscaPaciente] = useState('');

  const pacientesFiltrados = useMemo(() => {
    const termo = buscaPaciente.trim().toLowerCase();
    if (!pacientes || !termo) return pacientes || [];
    return pacientes.filter((p) => p.nome?.toLowerCase().includes(termo));
  }, [pacientes, buscaPaciente]);

  const enviar = (e) => {
    e.preventDefault();
    onSubmit({ ...form, descricao: form.descricao.trim() });
  };

  return (
    <form id={id} onSubmit={enviar}>
      {pacientes && !tratamento && (
        <div className="form-group">
          <label className="form-label">Paciente <span className="required">*</span></label>
          {pacientes.length > 8 && (
            <div className="search-input" style={{ marginBottom: 8 }}>
              <Search size={16} className="search-icon" />
              <input className="form-control" placeholder="Filtrar paciente pelo nome..."
                value={buscaPaciente} onChange={(e) => setBuscaPaciente(e.target.value)} />
            </div>
          )}
          <select className="form-control" value={form.pacienteId} required
            onChange={(e) => setForm((f) => ({ ...f, pacienteId: e.target.value }))}>
            <option value="">Selecione o paciente</option>
            {pacientesFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Descrição do tratamento <span className="required">*</span></label>
        <textarea className="form-control" required style={{ minHeight: 120 }}
          value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          placeholder="Descreva o tratamento: o que foi feito, dentes envolvidos, materiais, orientações..." />
      </div>

      <GaleriaUpload valor={form.imagens} onChange={(imagens) => setForm((f) => ({ ...f, imagens }))} />
    </form>
  );
}
