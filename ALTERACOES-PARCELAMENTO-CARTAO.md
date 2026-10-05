# Alterações — Parcelamento no cartão de crédito

Nenhuma dependência nova. A coluna `recibos.parcelas` é criada sozinha quando
o backend sobe (`src/database/db.js`), sem apagar dados. A tabela
`pagamentos` já tinha a coluna `parcelas` (estava sempre em 1).

## Como funciona

- No lançamento de pagamento (Financeiro → Novo pagamento / Editar), ao
  escolher **Cartão de Crédito** aparece o campo **Parcelas no cartão**,
  de "À vista" até **12x**. Cada opção já mostra o valor da parcela
  (ex.: "10x de R$ 150,00").
- A parcela é calculada sobre o **valor pago** (quando preenchido) ou sobre o
  **valor total**. Se a divisão não for exata, a diferença de centavos fica na
  1ª parcela, como nas maquininhas: R$ 100 em 3x = 1x de R$ 33,34 + 2x de R$ 33,33.
- Trocar para outra forma de pagamento volta automaticamente para 1 parcela
  (no formulário e no backend).
- O lançamento continua sendo **um registro só**: o paciente quita no ato e o
  valor entra no caixa na data do pagamento, como antes.

## Onde aparece

- **Lista de pagamentos** e **histórico financeiro do paciente** (coluna
  nova "Forma"): "Cartão de Crédito (10x)".
- **Recibo**: o rascunho já vem com as parcelas do pagamento; o campo também
  existe no recibo avulso. Impresso e WhatsApp: "pago em Cartão de Crédito em
  10x de R$ 150,00".
- **Relatório → Recebimentos por forma**: abaixo de cada forma, quantos
  recebimentos foram parcelados e o total.
- **Exportação CSV**: coluna Forma como `cartao_credito 10x`.
- **Auditoria**: criação registra "no cartão em 10x"; edição registra
  "parcelas 1x → 10x".

## Limite de parcelas

12x, definido em dois lugares (manter iguais):
`backend/src/utils/parcelas.js` e `frontend/src/utils/recibo.js`
(`MAX_PARCELAS_CARTAO`).

## Arquivos

Novos: `backend/src/utils/parcelas.js`,
`frontend/src/components/common/CampoParcelasCartao.jsx`.

Alterados: `backend/src/database/db.js`,
`backend/src/controllers/financeiroController.js`,
`backend/src/controllers/recibosController.js`,
`frontend/src/utils/recibo.js`,
`frontend/src/pages/Financeiro/FinanceiroPage.jsx`,
`frontend/src/components/common/ReciboModal.jsx`,
`frontend/src/pages/Pacientes/PacienteDetalhes.jsx`.
