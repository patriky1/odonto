# Alterações — autoria, financeiro por dentista, termos e prontuário automático

Nenhuma dependência nova. As tabelas e colunas novas são criadas sozinhas
na primeira vez que o backend sobe (`src/database/db.js`), sem apagar dados.

## 1. Quem fez cada registro (só o administrador vê)

- Agenda, tratamentos, recebimentos, outras receitas e gastos guardam
  `criadoPor*` e `atualizadoPor*`. Recibos e termos entram no log.
- Tabela `auditoria`: log de criar, editar, dar baixa, alterar status e
  **excluir** (a exclusão some da lista, mas fica no log).
- `utils/auditoria.js` tem um middleware global que retira esses campos de
  toda resposta para quem não é admin. Os outros perfis não recebem o dado,
  não é só esconder na tela.
- Nas listas, o admin vê "por Fulano · alterado por Beltrano" embaixo do
  registro. Nos modais de edição aparece com data e hora.
- Nova página **Registro de atividades** (`/auditoria`), só para admin, com
  filtros por período, tipo, usuário, ação e busca.
- Lançamentos antigos de receitas e gastos reaproveitam o `usuarioId` que já
  existia. Agenda, tratamentos e recebimentos antigos aparecem como "autor
  não identificado".

## 2. Financeiro filtrado por dentista

- O seletor de dentista saiu da aba Recebimentos e foi para junto do período.
  Agora vale para **tudo**: cards de resumo, recebimentos, gastos, receitas,
  recibos, relatório/DRE, gráficos e exportação CSV.
- Gastos e receitas ganharam o campo **Dentista** (opcional). Com o filtro
  ativo, entram só os lançamentos atribuídos àquele dentista. Gastos gerais
  da clínica (aluguel, luz...) ficam de fora, e a tela avisa isso.
- Com o filtro ativo, os novos lançamentos já vêm com o dentista preenchido.

## 3. Pacientes

- **Termos de autorização/consentimento** (aba "Termos" na ficha):
  8 modelos (geral, cirurgia, canal, ortodontia, implante, clareamento, uso de
  imagem e personalizado), preenchidos com os dados do paciente, dentista e
  clínica. O texto é editável até a assinatura.
  Assinatura **na tela** (dedo, caneta ou mouse) ou **no papel** (imprime,
  coleta e registra). Depois de assinado, o termo trava. Pode ser revogado
  (fica no histórico). Só o admin exclui termo assinado.
  > Revise os textos dos modelos com o jurídico ou o CRO da clínica
  > (`backend/src/controllers/termosController.js`).
- **Nome do paciente sempre é link para o perfil**: agenda (dia e semana),
  lembretes do WhatsApp, dashboard, tratamentos, financeiro (recebimentos e
  recibos), prontuários, registro de atividades e lista de pacientes.
  Componente: `components/common/LinkPaciente.jsx`.

## 4. Prontuário automático

- `GET /api/prontuarios/paciente/:id` monta o prontuário na hora, sem
  duplicar dados: atendimentos concluídos e faltas da agenda, tratamentos,
  odontograma (situação atual + histórico agrupado por dia), ortodontia,
  anamnese (alertas), termos assinados e anotações clínicas manuais.
- Tela **Prontuários** agora lista os pacientes com o resumo e abre
  `/prontuarios/:pacienteId`. O mesmo prontuário aparece na aba
  "Prontuário" da ficha do paciente.
- Linha do tempo com filtro por tipo, **Nova anotação** (diagnóstico,
  prescrição, evolução...) e **Imprimir** (respeita o filtro escolhido).
- Para um atendimento entrar no prontuário, marque-o como **Concluído** ou
  **Em atendimento** na agenda.

## Arquivos novos

Backend: `utils/auditoria.js`, `controllers/auditoriaController.js`,
`controllers/termosController.js`, `routes/auditoria.js`, `routes/termos.js`.

Frontend: `components/common/LinkPaciente.jsx`, `RegistradoPor.jsx`,
`AssinaturaCanvas.jsx`, `components/prontuario/ProntuarioAutomatico.jsx`,
`AnotacaoForm.jsx`, `pages/Auditoria/AuditoriaPage.jsx`,
`pages/Pacientes/TermosPanel.jsx`, `pages/Prontuarios/ProntuarioPaciente.jsx`,
`utils/impressao.js`.

## Como testar rápido

1. Entre como **recepcionista**, crie um agendamento e um pagamento.
2. Entre como **admin**: veja "por Recepcionista" nas listas e em
   *Registro de atividades*. Como recepcionista, isso não aparece.
3. Financeiro → escolha um dentista: os quatro cards e o DRE mudam juntos.
4. Paciente → aba *Termos* → Novo termo → assine na tela → Imprimir.
5. Agenda → marque uma consulta como *Concluído* → Prontuários → paciente.
