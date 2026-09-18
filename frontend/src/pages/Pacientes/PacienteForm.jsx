import { useState } from 'react';

const ESTADOS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

// Cidades onde o consultório atende
export const CIDADES_ATENDIMENTO = ['Santa Cruz - PB', 'Alexandria - RN'];

export default function PacienteForm({ paciente, onSubmit }) {
  const fmt = (d) => (d ? String(d).split('T')[0] : '');

  const [form, setForm] = useState({
    nome: paciente?.nome || '',
    cpf: paciente?.cpf || '',
    dataNascimento: fmt(paciente?.dataNascimento),
    sexo: paciente?.sexo || '',
    telefone: paciente?.telefone || '',
    whatsapp: paciente?.whatsapp || '',
    email: paciente?.email || '',
    endereco: paciente?.endereco || '',
    cidade: paciente?.cidade || '',
    estado: paciente?.estado || '',
    cep: paciente?.cep || '',
    responsavel: paciente?.responsavel || '',
    observacoes: paciente?.observacoes || '',
    cidadeAtendimento: paciente?.cidadeAtendimento || '',
    linkIdoc: paciente?.linkIdoc || '',
  });

  const [erroIdoc, setErroIdoc] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const setIdoc = (e) => {
    const v = e.target.value;
    setForm(f => ({ ...f, linkIdoc: v }));
    setErroIdoc(v && !/^https?:\/\//i.test(v) ? 'O link deve começar com http:// ou https://' : '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (erroIdoc) return;
    onSubmit(form);
  };

  return (
    <form id="form-paciente" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Nome completo <span className="required">*</span></label>
          <input className="form-control" value={form.nome} onChange={set('nome')} required placeholder="Nome do paciente" />
        </div>
        <div className="form-group">
          <label className="form-label">CPF</label>
          <input className="form-control" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
        </div>
        <div className="form-group">
          <label className="form-label">Data de Nascimento</label>
          <input type="date" className="form-control" value={form.dataNascimento} onChange={set('dataNascimento')} />
        </div>
        <div className="form-group">
          <label className="form-label">Sexo</label>
          <select className="form-control" value={form.sexo} onChange={set('sexo')}>
            <option value="">Selecione</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
            <option value="O">Outro</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Telefone</label>
          <input className="form-control" value={form.telefone} onChange={set('telefone')} placeholder="(00) 00000-0000" />
        </div>
        <div className="form-group">
          <label className="form-label">WhatsApp</label>
          <input className="form-control" value={form.whatsapp} onChange={set('whatsapp')} placeholder="(00) 00000-0000" />
        </div>
        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input type="email" className="form-control" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Endereço</label>
          <input className="form-control" value={form.endereco} onChange={set('endereco')} placeholder="Rua, número, complemento" />
        </div>
        <div className="form-group">
          <label className="form-label">Cidade</label>
          <input className="form-control" value={form.cidade} onChange={set('cidade')} placeholder="Cidade" />
        </div>
        <div className="form-group">
          <label className="form-label">Estado</label>
          <select className="form-control" value={form.estado} onChange={set('estado')}>
            <option value="">UF</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">CEP</label>
          <input className="form-control" value={form.cep} onChange={set('cep')} placeholder="00000-000" />
        </div>
        <div className="form-group">
          <label className="form-label">Responsável</label>
          <input className="form-control" value={form.responsavel} onChange={set('responsavel')} placeholder="Nome do responsável" />
        </div>
        <div className="form-group">
          <label className="form-label">Cidade de atendimento</label>
          <select className="form-control" value={form.cidadeAtendimento} onChange={set('cidadeAtendimento')}>
            <option value="">Selecione</option>
            {CIDADES_ATENDIMENTO.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Link do iDoc <span className="text-muted text-xs">(opcional)</span></label>
          <input
            type="url"
            className="form-control"
            value={form.linkIdoc}
            onChange={setIdoc}
            placeholder="https://..."
            style={erroIdoc ? { borderColor: 'var(--danger)' } : undefined}
          />
          {erroIdoc
            ? <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{erroIdoc}</p>
            : <p className="text-xs text-muted mt-1">Endereço da página deste paciente no iDoc.</p>}
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Observações</label>
          <textarea className="form-control" value={form.observacoes} onChange={set('observacoes')} placeholder="Observações gerais sobre o paciente..." />
        </div>
      </div>
    </form>
  );
}
