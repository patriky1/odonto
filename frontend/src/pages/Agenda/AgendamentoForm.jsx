import { useState } from 'react';
import { dataISO } from '../../utils/formatters';
import LinkPaciente from '../../components/common/LinkPaciente';

const somarMinutos = (hora, minutos) => {
  const [h, m] = String(hora || '00:00').split(':').map(Number);
  const total = Math.min((h || 0) * 60 + (m || 0) + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export default function AgendamentoForm({ agendamento, pacientes, dentistas, procedimentos, salas = [], onSubmit, escopo }) {
  const fmt = (d) => (d ? String(d).split('T')[0] : '');

  // Dentista logado só agenda para si mesmo; admin/recepção já vêm com o dentista do filtro, se houver
  const dentistaTravado = escopo?.dentistaId || null;

  const [form, setForm] = useState({
    pacienteId: agendamento?.pacienteId || '',
    dentistaId: agendamento?.dentistaId || dentistaTravado || escopo?.dentistaSugerido || '',
    procedimentoId: agendamento?.procedimentoId || '',
    salaId: agendamento?.salaId || escopo?.salaSugerida || '',
    data: fmt(agendamento?.data) || escopo?.dataSugerida || dataISO(new Date()),
    horaInicio: agendamento?.horaInicio || '09:00',
    horaFim: agendamento?.horaFim || '09:30',
    status: agendamento?.status || 'agendado',
    observacoes: agendamento?.observacoes || '',
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Ao escolher um procedimento com duração cadastrada, sugere a hora de término
  const escolherProcedimento = (e) => {
    const id = e.target.value;
    const proc = procedimentos.find((p) => String(p.id) === String(id));
    setForm((f) => ({
      ...f,
      procedimentoId: id,
      horaFim: proc?.duracao ? somarMinutos(f.horaInicio, Number(proc.duracao)) : f.horaFim,
    }));
  };

  // Mudar o início mantém a mesma duração
  const mudarInicio = (e) => {
    const novo = e.target.value;
    setForm((f) => {
      const [h1, m1] = f.horaInicio.split(':').map(Number);
      const [h2, m2] = (f.horaFim || '').split(':').map(Number);
      const duracao = f.horaFim ? (h2 * 60 + m2) - (h1 * 60 + m1) : 0;
      return { ...f, horaInicio: novo, horaFim: duracao > 0 && novo ? somarMinutos(novo, duracao) : f.horaFim };
    });
  };

  const fimInvalido = form.horaFim && form.horaInicio && form.horaFim <= form.horaInicio;

  return (
    <form id="form-agendamento" onSubmit={e => { e.preventDefault(); if (!fimInvalido) onSubmit(form); }}>
      <div className="form-group">
        <label className="form-label">Paciente <span className="required">*</span></label>
        <select className="form-control" value={form.pacienteId} onChange={set('pacienteId')} required>
          <option value="">Selecione o paciente</option>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {form.pacienteId && (
          <p className="text-xs mt-1">
            <LinkPaciente id={form.pacienteId} className="text-primary">
              Abrir perfil de {pacientes.find((p) => String(p.id) === String(form.pacienteId))?.nome || 'paciente'}
            </LinkPaciente>
          </p>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Dentista <span className="required">*</span></label>
        <select className="form-control" value={form.dentistaId} onChange={set('dentistaId')} required disabled={!!dentistaTravado}>
          <option value="">Selecione o dentista</option>
          {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome} {d.especialidade ? `(${d.especialidade})` : ''}</option>)}
        </select>
        {dentistaTravado && (
          <p className="text-xs text-muted mt-1">Você só pode criar agendamentos na sua própria agenda.</p>
        )}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Procedimento</label>
          <select className="form-control" value={form.procedimentoId} onChange={escolherProcedimento}>
            <option value="">Selecione o procedimento</option>
            {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome}{p.duracao ? ` (${p.duracao} min)` : ''}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Sala de atendimento</label>
          <select className="form-control" value={form.salaId} onChange={set('salaId')} disabled={salas.length === 0}>
            <option value="">{salas.length === 0 ? 'Nenhuma sala cadastrada' : 'Sem sala definida'}</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            {/* Sala desativada que ainda está gravada neste agendamento */}
            {agendamento?.salaId && !salas.some(s => s.id === agendamento.salaId) && (
              <option value={agendamento.salaId}>{agendamento.salaNome || 'Sala desativada'}</option>
            )}
          </select>
          <p className="text-xs text-muted mt-1">
            {salas.length === 0
              ? 'O administrador cadastra as salas em Configurações.'
              : 'Em salas diferentes, o mesmo dentista pode ter horários simultâneos.'}
          </p>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Data <span className="required">*</span></label>
          <input type="date" className="form-control" value={form.data} onChange={set('data')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-control" value={form.status} onChange={set('status')}>
            <option value="agendado">Agendado</option>
            <option value="confirmado">Confirmado</option>
            <option value="em_atendimento">Em Atendimento</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
            <option value="nao_compareceu">Não Compareceu</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Hora Início <span className="required">*</span></label>
          <input type="time" className="form-control" value={form.horaInicio} onChange={mudarInicio} required />
        </div>
        <div className="form-group">
          <label className="form-label">Hora Fim</label>
          <input type="time" className="form-control" value={form.horaFim} onChange={set('horaFim')}
            style={fimInvalido ? { borderColor: 'var(--danger)' } : undefined} />
          {fimInvalido && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>O término deve ser depois do início.</p>}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Observações</label>
        <textarea className="form-control" value={form.observacoes} onChange={set('observacoes')} placeholder="Observações sobre a consulta..." />
      </div>
    </form>
  );
}
