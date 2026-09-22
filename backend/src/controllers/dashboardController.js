const db = require('../database/db');
const { dentistaDoUsuario } = require('../utils/escopo');
const { hojeISO, somarMeses } = require('../utils/datas');

exports.resumo = (req, res) => {
  try {
    const hoje = hojeISO(); // fuso da clínica (evita virar o dia às 21h)
    const mesAtual = hoje.substring(0, 7);

    // Dentista enxerga somente a própria agenda também no dashboard
    const meuDentista = req.usuario?.perfil === 'dentista' ? dentistaDoUsuario(req.usuario) : null;
    const filtroDentista = meuDentista ? ' AND dentistaId = ' + Number(meuDentista.id) : '';
    const filtroDentistaA = meuDentista ? ' AND a.dentistaId = ' + Number(meuDentista.id) : '';

    const totalPacientes = db.prepare('SELECT COUNT(*) as c FROM pacientes WHERE ativo = 1').get().c;
    const consultasHoje = db.prepare(`SELECT COUNT(*) as c FROM agendamentos WHERE data = ?${filtroDentista}`).get(hoje).c;
    const consultasConcluidas = db.prepare(`SELECT COUNT(*) as c FROM agendamentos WHERE data = ? AND status = 'concluido'${filtroDentista}`).get(hoje).c;
    const consultasCanceladas = db.prepare(`SELECT COUNT(*) as c FROM agendamentos WHERE data = ? AND status = 'cancelado'${filtroDentista}`).get(hoje).c;
    const novosPacientesMes = db.prepare("SELECT COUNT(*) as c FROM pacientes WHERE strftime('%Y-%m', createdAt) = ? AND ativo = 1").get(mesAtual).c;
    const pagamentosPendentes = db.prepare("SELECT COUNT(*) as c FROM pagamentos WHERE status = 'pendente'").get().c;
    const pagamentosAtrasados = db.prepare("SELECT COUNT(*) as c FROM pagamentos WHERE status = 'atrasado'").get().c;

    const faturamentoMes = db.prepare("SELECT COALESCE(SUM(valorPago), 0) as total FROM pagamentos WHERE strftime('%Y-%m', dataPagamento) = ? AND status = 'pago'").get(mesAtual).total;

    const proximosAtendimentos = db.prepare(`SELECT a.*, p.nome as pacienteNome, d.nome as dentistaNome, pr.nome as procedimentoNome FROM agendamentos a LEFT JOIN pacientes p ON a.pacienteId = p.id LEFT JOIN dentistas d ON a.dentistaId = d.id LEFT JOIN procedimentos pr ON a.procedimentoId = pr.id WHERE a.data >= ? AND a.status = 'agendado'${filtroDentistaA} ORDER BY a.data, a.horaInicio LIMIT 5`).all(hoje);

    // Aniversariantes do mês
    const mesNum = hoje.substring(5, 7);
    const aniversariantes = db.prepare("SELECT id, nome, dataNascimento, telefone FROM pacientes WHERE ativo = 1 AND strftime('%m', dataNascimento) = ? ORDER BY strftime('%d', dataNascimento) LIMIT 10").all(mesNum);

    // Agendamentos por status (hoje)
    const porStatus = db.prepare(`SELECT status, COUNT(*) as quantidade FROM agendamentos WHERE data = ?${filtroDentista} GROUP BY status`).all(hoje);

    // Faturamento mensal (últimos 6 meses)
    const faturamentoMensal = [];
    for (let i = 5; i >= 0; i--) {
      const ym = somarMeses(mesAtual, -i);
      const total = db.prepare("SELECT COALESCE(SUM(valorPago), 0) as total FROM pagamentos WHERE strftime('%Y-%m', dataPagamento) = ? AND status = 'pago'").get(ym).total;
      faturamentoMensal.push({ mes: ym, total });
    }

    res.json({
      totalPacientes, consultasHoje, consultasConcluidas, consultasCanceladas,
      novosPacientesMes, pagamentosPendentes, pagamentosAtrasados,
      faturamentoMes, proximosAtendimentos, aniversariantes,
      agendamentosPorStatus: porStatus, faturamentoMensal
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
};
