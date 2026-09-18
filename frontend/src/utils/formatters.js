export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

/**
 * Converte o valor em Date. Datas "puras" (YYYY-MM-DD) são tratadas como
 * dia local — `new Date('2026-09-10')` seria meia-noite UTC, que no Brasil
 * aparece como 09/09.
 */
export const paraData = (date) => {
  if (date instanceof Date) return date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [a, m, d] = date.split('-').map(Number);
    return new Date(a, m - 1, d);
  }
  return new Date(date);
};

/** Data local no formato YYYY-MM-DD (para inputs type="date" e para a API). */
export const dataISO = (date = new Date()) => {
  const d = paraData(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDate = (date) => {
  if (!date) return '-';
  return paraData(date).toLocaleDateString('pt-BR');
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('pt-BR');
};

export const formatCPF = (cpf) => {
  if (!cpf) return '-';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatPhone = (phone) => {
  if (!phone) return '-';
  return phone;
};

export const getInitials = (nome) => {
  if (!nome) return '?';
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

export const getAvatarColor = (id) => {
  const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#d97706'];
  return colors[(id || 0) % colors.length];
};

export const getStatusAgendamento = (status) => {
  const map = {
    agendado: { label: 'Agendado', className: 'badge-primary' },
    confirmado: { label: 'Confirmado', className: 'badge-info' },
    em_atendimento: { label: 'Em Atendimento', className: 'badge-warning' },
    concluido: { label: 'Concluído', className: 'badge-success' },
    cancelado: { label: 'Cancelado', className: 'badge-danger' },
    nao_compareceu: { label: 'Não Compareceu', className: 'badge-gray' },
  };
  return map[status] || { label: status, className: 'badge-gray' };
};

export const getStatusPagamento = (status) => {
  const map = {
    pago: { label: 'Pago', className: 'badge-success' },
    pendente: { label: 'Pendente', className: 'badge-warning' },
    atrasado: { label: 'Atrasado', className: 'badge-danger' },
    cancelado: { label: 'Cancelado', className: 'badge-gray' },
  };
  return map[status] || { label: status, className: 'badge-gray' };
};

export const getStatusTratamento = (status) => {
  const map = {
    nao_iniciado: { label: 'Não Iniciado', className: 'badge-gray' },
    em_andamento: { label: 'Em Andamento', className: 'badge-warning' },
    concluido: { label: 'Concluído', className: 'badge-success' },
    cancelado: { label: 'Cancelado', className: 'badge-danger' },
  };
  return map[status] || { label: status, className: 'badge-gray' };
};

export const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = paraData(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
};

/**
 * Número de WhatsApp no formato internacional (só dígitos, com 55).
 * Retorna null se o telefone não parecer válido.
 */
export const numeroWhatsApp = (telefone) => {
  let n = String(telefone || '').replace(/\D/g, '');
  if (!n) return null;
  n = n.replace(/^0+/, '');
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  if (!(n.startsWith('55') && (n.length === 12 || n.length === 13))) return null;
  return n;
};
