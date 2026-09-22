const bcrypt = require('bcryptjs');
const db = require('../src/database/db');

async function seed() {
  console.log('🌱 Iniciando seed...');

  // Limpar tabelas
  db.exec(`
    DELETE FROM notificacoes;
    DELETE FROM despesas;
    DELETE FROM receitas;
    DELETE FROM pagamentos;
    DELETE FROM ortodontia;
    DELETE FROM anamneses;
    DELETE FROM odontograma_historico;
    DELETE FROM odontograma_ficha;
    DELETE FROM odontograma;
    DELETE FROM tratamentos;
    DELETE FROM prontuarios;
    DELETE FROM agendamentos;
    DELETE FROM procedimentos;
    DELETE FROM dentistas;
    DELETE FROM pacientes;
    DELETE FROM usuarios;
  `);

  // Usuários
  const senhaHash = await bcrypt.hash('123456', 10);
  const u1 = db.prepare("INSERT INTO usuarios (nome, email, senha, perfil, ativo) VALUES (?, ?, ?, ?, 1)").run('Administrador', 'admin@odonto.com', senhaHash, 'admin');
  const u2 = db.prepare("INSERT INTO usuarios (nome, email, senha, perfil, ativo) VALUES (?, ?, ?, ?, 1)").run('Dr. João Silva', 'dentista@odonto.com', senhaHash, 'dentista');
  const u3 = db.prepare("INSERT INTO usuarios (nome, email, senha, perfil, ativo) VALUES (?, ?, ?, ?, 1)").run('Recepcionista', 'recepcao@odonto.com', senhaHash, 'recepcionista');
  console.log('✅ Usuários criados');

  // Dentistas
  // usuarioId vincula o dentista ao login — é o que faz a agenda individual funcionar
  const d1 = db.prepare("INSERT INTO dentistas (nome, cro, especialidade, telefone, email, diasAtendimento, horariosDisponiveis, usuarioId, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)").run('Dr. João Silva', 'CRO-SP 12345', 'Clínico Geral', '(11) 99999-0001', 'dentista@odonto.com', JSON.stringify(['segunda','terca','quarta','quinta','sexta']), JSON.stringify({ inicio: '08:00', fim: '18:00' }), u2.lastInsertRowid);
  const d2 = db.prepare("INSERT INTO dentistas (nome, cro, especialidade, telefone, email, diasAtendimento, horariosDisponiveis, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)").run('Dra. Maria Santos', 'CRO-SP 67890', 'Ortodontia', '(11) 99999-0002', 'maria@odonto.com', JSON.stringify(['terca','quarta','quinta','sexta']), JSON.stringify({ inicio: '09:00', fim: '17:00' }));
  console.log('✅ Dentistas criados (Dr. João Silva vinculado ao login dentista@odonto.com)');

  // Procedimentos
  const procs = [
    ['Consulta', 'Consulta inicial', 80, 30],
    ['Limpeza', 'Profilaxia dental', 150, 45],
    ['Restauração', 'Restauração com resina', 250, 60],
    ['Extração', 'Extração simples', 200, 30],
    ['Canal', 'Tratamento de canal', 800, 90],
    ['Clareamento', 'Clareamento dental', 600, 60],
    ['Aparelho', 'Instalação de aparelho', 1500, 90],
    ['Manutenção de Aparelho', 'Manutenção mensal', 150, 30],
    ['Implante', 'Implante dentário', 3500, 120],
    ['Coroa', 'Coroa de porcelana', 1800, 90],
    ['Radiografia', 'Radiografia periapical', 60, 15],
    ['Fluoretação', 'Aplicação de flúor', 80, 20],
    ['Onlay', 'Restauração indireta', 900, 60],
    ['Faceta', 'Faceta de porcelana', 2500, 90],
    ['Prótese', 'Prótese parcial removível', 2000, 90],
  ];
  const procIds = procs.map(([nome, desc, valor, dur]) => db.prepare("INSERT INTO procedimentos (nome, descricao, valor, duracao, ativo) VALUES (?, ?, ?, ?, 1)").run(nome, desc, valor, dur).lastInsertRowid);
  console.log('✅ Procedimentos criados');

  // Pacientes
  const hoje = new Date().toISOString().split('T')[0];
  const pacs = [
    ['Ana Paula Oliveira', '123.456.789-01', '1985-03-15', 'F', '(11) 98765-4321'],
    ['Bruno Costa', '234.567.890-12', '1990-07-22', 'M', '(11) 97654-3210'],
    ['Carla Mendes', '345.678.901-23', '1978-11-30', 'F', '(11) 96543-2109'],
    ['Daniel Pereira', '456.789.012-34', '2000-05-10', 'M', '(11) 95432-1098'],
    ['Elena Rodrigues', '567.890.123-45', '1995-08-25', 'F', '(11) 94321-0987'],
  ];
  const CIDADES = ['Santa Cruz - PB', 'Alexandria - RN'];
  const pacIds = pacs.map(([nome, cpf, dataNasc, sexo, tel], i) =>
    db.prepare("INSERT INTO pacientes (nome, cpf, dataNascimento, sexo, telefone, cidadeAtendimento, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)")
      .run(nome, cpf, dataNasc, sexo, tel, CIDADES[i % CIDADES.length]).lastInsertRowid);
  console.log('✅ Pacientes criados');

  // Agendamentos
  const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  db.prepare("INSERT INTO agendamentos (pacienteId, dentistaId, procedimentoId, data, horaInicio, horaFim, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pacIds[0], d1.lastInsertRowid, procIds[0], hoje, '09:00', '09:30', 'agendado');
  db.prepare("INSERT INTO agendamentos (pacienteId, dentistaId, procedimentoId, data, horaInicio, horaFim, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pacIds[1], d1.lastInsertRowid, procIds[1], hoje, '10:00', '10:45', 'concluido');
  db.prepare("INSERT INTO agendamentos (pacienteId, dentistaId, procedimentoId, data, horaInicio, horaFim, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pacIds[2], d2.lastInsertRowid, procIds[2], hoje, '14:00', '15:00', 'agendado');
  db.prepare("INSERT INTO agendamentos (pacienteId, dentistaId, procedimentoId, data, horaInicio, horaFim, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pacIds[3], d1.lastInsertRowid, procIds[4], amanha, '08:00', '09:30', 'agendado');
  db.prepare("INSERT INTO agendamentos (pacienteId, dentistaId, procedimentoId, data, horaInicio, horaFim, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pacIds[4], d2.lastInsertRowid, procIds[6], amanha, '10:00', '11:30', 'agendado');
  console.log('✅ Agendamentos criados');

  // Pagamentos
  db.prepare("INSERT INTO pagamentos (pacienteId, descricao, valor, valorPago, dataPagamento, formaPagamento, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pacIds[1], 'Limpeza', 150, 150, hoje, 'pix', 'pago');
  db.prepare("INSERT INTO pagamentos (pacienteId, descricao, valor, valorPago, dataVencimento, status) VALUES (?, ?, ?, ?, ?, ?)").run(pacIds[0], 'Consulta', 80, 0, amanha, 'pendente');
  db.prepare("INSERT INTO pagamentos (pacienteId, descricao, valor, valorPago, dataVencimento, status) VALUES (?, ?, ?, ?, ?, ?)").run(pacIds[2], 'Restauração', 250, 0, hoje, 'atrasado');
  db.prepare("INSERT INTO pagamentos (pacienteId, descricao, valor, valorPago, dataPagamento, formaPagamento, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pacIds[3], 'Canal', 800, 400, hoje, 'parcelado', 'pendente');
  // Recebimentos ao longo do mês (para o relatório financeiro ficar realista)
  const insPago = db.prepare("INSERT INTO pagamentos (pacienteId, descricao, valor, valorPago, dataPagamento, formaPagamento, dentistaId, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pago')");
  const dentistaIds = [d1.lastInsertRowid, d2.lastInsertRowid];
  const diaDoMes = (d) => `${hoje.substring(0, 7)}-${String(d).padStart(2, '0')}`;
  [
    [0, 'Clareamento dental', 600, 3, 'pix'],
    [1, 'Instalação de aparelho', 1500, 5, 'cartao_credito'],
    [2, 'Implante dentário', 3500, 8, 'cartao_credito'],
    [3, 'Coroa de porcelana', 1800, 10, 'pix'],
    [4, 'Tratamento de canal', 800, 12, 'dinheiro'],
    [0, 'Manutenção de aparelho', 150, 15, 'pix'],
    [1, 'Profilaxia + flúor', 230, 18, 'cartao_debito'],
    [2, 'Facetas de porcelana', 7500, 20, 'cartao_credito'],
    [3, 'Prótese parcial removível', 2000, 22, 'boleto'],
    [4, 'Radiografias', 180, 24, 'dinheiro'],
  ].forEach(([idx, desc, valor, dia, forma]) => {
    insPago.run(pacIds[idx % pacIds.length], desc, valor, valor, diaDoMes(dia), forma, dentistaIds[idx % 2]);
  });
  console.log('✅ Pagamentos criados');

  // Receitas avulsas
  const insReceita = db.prepare("INSERT INTO receitas (descricao, valor, data, categoria, formaPagamento, origem) VALUES (?, ?, ?, ?, ?, ?)");
  insReceita.run('Repasse convênio odontológico', 2500, hoje, 'convenios', 'transferencia', 'Unimed Odonto');
  insReceita.run('Venda de kits de higiene bucal', 480, hoje, 'produtos', 'pix', 'Balcão');
  console.log('✅ Receitas criadas');

  // Despesas — gastos da empresa (com fornecedor, vencimento, situação e recorrência)
  const insDespesa = db.prepare(`INSERT INTO despesas
    (descricao, valor, data, categoria, fornecedor, formaPagamento, dataVencimento, status, recorrente, frequencia, centroCusto, documento, observacoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const gastos = [
    ['Aluguel do consultório',        3500,  'aluguel',           'Imobiliária Central',   'boleto',            'pago',     1, 'mensal', 'infraestrutura', 'NF 8821', null],
    ['Condomínio',                     680,  'condominio',        'Ed. Saúde Center',      'boleto',            'pago',     1, 'mensal', 'infraestrutura', null, null],
    ['Energia elétrica',               540,  'agua_luz',          'Concessionária',        'debito_automatico', 'pago',     1, 'mensal', 'infraestrutura', null, null],
    ['Internet e telefonia',           260,  'internet_telefone', 'Provedor Fibra',        'debito_automatico', 'pago',     1, 'mensal', 'administrativo', null, null],
    ['Salários da equipe',            8000,  'pessoal',           null,                    'transferencia',     'pago',     1, 'mensal', 'administrativo', null, 'Folha de pagamento'],
    ['Materiais odontológicos',       1200,  'materiais',         'Dental Cremer',         'cartao_credito',    'pago',     0, null,     'clinico',        'NF 12345', 'Resinas, anestésicos e descartáveis'],
    ['Trabalhos protéticos',           950,  'laboratorio',       'Lab. Protec',           'pix',               'pendente', 0, null,     'clinico',        null, 'Coroa e prótese parcial'],
    ['Manutenção do compressor',       420,  'manutencao',        'TecnoOdonto',           'pix',               'pago',     0, null,     'infraestrutura', 'OS 4471', null],
    ['Mensalidade do sistema',         199,  'software',          'OdontoSys',             'cartao_credito',    'pago',     1, 'mensal', 'administrativo', null, null],
    ['Honorários contábeis',           650,  'contabilidade',     'Contabilidade Prime',   'boleto',            'pago',     1, 'mensal', 'administrativo', null, null],
    ['Simples Nacional (DAS)',        1450,  'impostos',          'Receita Federal',       'boleto',            'pendente', 1, 'mensal', 'administrativo', null, null],
    ['Anúncios em redes sociais',      380,  'marketing',         'Meta Ads',              'cartao_credito',    'pago',     0, null,     'comercial',      null, null],
    ['Taxas da maquininha',            290,  'taxas_bancarias',   'Adquirente',            'debito_automatico', 'pago',     0, null,     'administrativo', null, null],
    ['Serviço de limpeza',             700,  'limpeza',           'Clean Service',         'pix',               'pago',     1, 'mensal', 'infraestrutura', null, null],
  ];

  gastos.forEach(([desc, valor, cat, forn, forma, status, rec, freq, centro, doc, obs]) => {
    insDespesa.run(desc, valor, hoje, cat, forn, forma, status === 'pago' ? hoje : amanha, status, rec, freq, centro, doc, obs);
  });
  console.log(`✅ ${gastos.length} despesas da empresa criadas`);

  // Odontograma de exemplo + ficha clínica do primeiro paciente
  const insDente = db.prepare("INSERT INTO odontograma (pacienteId, numeroDente, face, status, procedimento, observacoes) VALUES (?, ?, ?, ?, ?, ?)");
  insDente.run(pacIds[0], 36, null, 'cariado', 'Restauração indicada', 'Cárie oclusal profunda');
  insDente.run(pacIds[0], 36, 'O', 'cariado', null, null);
  insDente.run(pacIds[0], 11, null, 'restaurado', 'Restauração em resina', null);
  insDente.run(pacIds[0], 46, null, 'tratamento_canal', 'Endodontia concluída', null);
  insDente.run(pacIds[0], 18, null, 'ausente', 'Extraído', 'Extração realizada em 2023');
  insDente.run(pacIds[1], 21, null, 'protese', 'Coroa de porcelana', null);
  db.prepare(`INSERT INTO odontograma_ficha (pacienteId, queixaPrincipal, anamnese, alertas, observacoesGerais, atualizadoPor)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(pacIds[0], 'Sensibilidade no molar inferior esquerdo',
      'Paciente relata desconforto ao ingerir alimentos gelados há cerca de duas semanas.',
      'Alergia a penicilina', 'Retorno agendado para acompanhamento.', 'Administrador');
  console.log('✅ Odontograma de exemplo criado');

  // Anamnese de exemplo (com alertas clínicos)
  db.prepare("INSERT INTO anamneses (pacienteId, respostas, observacoes, preenchidoPor) VALUES (?, ?, ?, ?)")
    .run(pacIds[0], JSON.stringify({
      tratamento_medico: { valor: 'nao', detalhe: null },
      medicamentos: { valor: 'sim', detalhe: 'Losartana 50mg, 1x ao dia' },
      alergia_medicamento: { valor: 'sim', detalhe: 'Penicilina' },
      pressao: { valor: 'Alta (hipertensão)', detalhe: null },
      diabetes: { valor: 'nao', detalhe: null },
      fumante: { valor: 'nao', detalhe: null },
      bruxismo: { valor: 'sim', detalhe: 'Durante a noite' },
      escovacoes: { valor: '2x', detalhe: null },
      fio_dental: { valor: 'Às vezes', detalhe: null },
      queixa_principal: { valor: 'Sensibilidade no molar inferior esquerdo ao tomar gelado.', detalhe: null },
    }), 'Paciente colaborativa, retorno em 6 meses para profilaxia.', 'Administrador');

  // Procedimentos ortodônticos de exemplo
  const insOrto = db.prepare(`INSERT INTO ortodontia
    (pacienteId, dentistaId, data, tipoAparelho, procedimento, arcada, fioUtilizado, elasticos, orientacoes, proximaConsulta, valor, usuarioNome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const mesPassado = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const proxMes = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  insOrto.run(pacIds[3], d2.lastInsertRowid, mesPassado, 'Fixo metálico', 'Instalação de aparelho', 'Ambas', 'NiTi 0.014', null, 'Evitar alimentos duros nas primeiras 48h.', hoje, 1500, 'Administrador');
  insOrto.run(pacIds[3], d2.lastInsertRowid, hoje, 'Fixo metálico', 'Manutenção mensal', 'Ambas', 'NiTi 0.016', 'Classe II 3/16 médio', 'Usar os elásticos 20h por dia.', proxMes, 150, 'Administrador');
  console.log('✅ Anamnese e ortodontia de exemplo criadas');

  // Notificações
  db.prepare("INSERT INTO notificacoes (tipo, titulo, mensagem) VALUES (?, ?, ?)").run('info', 'Sistema iniciado', 'Bem-vindo ao OdontoSys! Sistema configurado com sucesso.');
  db.prepare("INSERT INTO notificacoes (tipo, titulo, mensagem) VALUES (?, ?, ?)").run('alerta', 'Pagamento atrasado', 'Carla Mendes possui pagamento em atraso.');
  console.log('✅ Notificações criadas');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\n📋 Credenciais de acesso:');
  console.log('  Admin:        admin@odonto.com / 123456');
  console.log('  Dentista:     dentista@odonto.com / 123456');
  console.log('  Recepcionista: recepcao@odonto.com / 123456');
}

seed().catch(console.error);
