# Emissão de recibos — o que foi implementado

Funcionalidade nova: emitir, imprimir, reimprimir e cancelar recibos entregues ao paciente,
usando os dados cadastrados da empresa e do paciente.

---

## 1. Arquivos

### Novos

| Arquivo | Para que serve |
|---|---|
| `backend/src/controllers/recibosController.js` | Emissão, listagem, rascunho a partir de um pagamento e cancelamento |
| `backend/src/routes/recibos.js` | Rotas `/api/recibos` |
| `frontend/src/utils/recibo.js` | Monta o HTML do recibo, imprime, valor por extenso, texto para WhatsApp |
| `frontend/src/components/common/ReciboModal.jsx` | Tela de emissão + prévia + impressão |
| `frontend/src/components/common/DadosEmpresaConfig.jsx` | Cadastro dos dados da empresa (Configurações) |

### Alterados

| Arquivo | O que mudou |
|---|---|
| `backend/src/database/db.js` | Tabela `recibos` + índices (inclusive o índice único de numeração) |
| `backend/src/controllers/configuracoesController.js` | Leitura e gravação dos dados da empresa (`lerClinica`, `dadosClinica`, `salvarDadosClinica`) |
| `backend/src/routes/configuracoes.js` | `GET/PUT /api/configuracoes/clinica` |
| `backend/src/app.js` | Registra `/api/recibos` |
| `frontend/src/pages/ConfiguracoesPage.jsx` | Card "Dados da Empresa" (somente admin) |
| `frontend/src/pages/Financeiro/FinanceiroPage.jsx` | Botão de recibo em cada recebimento + aba "Recibos" |
| `frontend/src/pages/Pacientes/PacienteDetalhes.jsx` | Botão "Emitir recibo" no topo e por pagamento |

Nada foi removido e nenhuma rota antiga mudou de comportamento. A tabela `recibos` é criada
sozinha na primeira inicialização do backend (`CREATE TABLE IF NOT EXISTS`), sem migração manual.

---

## 2. Como usar

1. **Configurações → Dados da Empresa** (admin): razão social, CNPJ ou CPF, responsável técnico e
   CRO, endereço, contatos, logomarca e o texto fixo do rodapé. Sem a razão social preenchida o
   sistema recusa a emissão — é o cabeçalho do documento.
   O botão **Ver modelo do recibo** imprime um exemplo fictício para conferir antes de usar com paciente.
2. **Emitir**, por qualquer um destes caminhos:
   - Financeiro → Recebimentos → ícone de recibo na linha (vem preenchido com paciente, valor pago,
     descrição, forma e data);
   - Financeiro → aba **Recibos** → botão "Emitir Recibo" (recibo avulso);
   - Ficha do paciente → "Emitir recibo", ou o ícone na aba Financeiro.
3. **Imprimir**: abre a caixa de impressão do navegador. Para PDF, escolher "Salvar como PDF" no
   destino da impressão. Por padrão saem duas vias na mesma folha A4 (cliente e clínica);
   dá para desmarcar e imprimir só uma.
4. **Segunda via**: aba Recibos → ícone de impressora.
5. **Cancelar** (admin/dentista): o recibo continua na lista com marca d'água "CANCELADO",
   guardando motivo e quem cancelou. O número usado não é reaproveitado.

---

## 3. Decisões que valem saber

**Numeração sequencial por ano** — `0001/2026`, `0002/2026`. Índice único em `(ano, numero)`
impede número repetido; se duas pessoas emitirem ao mesmo tempo, o segundo pega o número seguinte.

**Cópia congelada dos dados** — cada recibo guarda em JSON os dados da empresa, do paciente e do
profissional como estavam na emissão. Se a clínica mudar de endereço depois, a segunda via continua
igual ao papel que o paciente recebeu.

**Pagador separado do paciente** — o nome e o CPF de quem pagou são editáveis. Quando quem paga é o
responsável por um menor, é esse CPF que vale para o Imposto de Renda dele.

**Recibo não se apaga** — só se cancela, para não abrir buraco na numeração.

**Valor por extenso** — gerado no frontend (`valorPorExtenso`), tratando os casos chatos:
`R$ 1,00` → "um real", `R$ 1.000,00` → "mil reais", `R$ 1.000.000,00` → "um milhão de reais",
`R$ 2.500,05` → "dois mil e quinhentos reais e cinco centavos".

**Impressão sem dependência nova** — o documento é montado como HTML e impresso por um iframe
oculto. Não precisou instalar biblioteca de PDF, e não depende de pop-up liberado no navegador.

---

## 4. API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/configuracoes/clinica` | Dados da empresa |
| PUT | `/api/configuracoes/clinica` | Salva os dados (somente admin) |
| GET | `/api/recibos` | Lista. Filtros: `inicio`, `fim`, `pacienteId`, `busca`, `incluirCancelados` |
| GET | `/api/recibos/:id` | Um recibo |
| GET | `/api/recibos/pagamento/:id` | Recibos já emitidos para aquele recebimento |
| GET | `/api/recibos/pagamento/:id/rascunho` | Campos sugeridos para um novo recibo |
| POST | `/api/recibos` | Emite |
| PATCH | `/api/recibos/:id/cancelar` | Cancela (admin/dentista) |

---

## 5. Testes feitos

Backend testado contra uma cópia do `dev.db`, com todos os casos passando: emissão, sequência
numérica, rascunho a partir do pagamento, recusa sem paciente / sem descrição / valor zero /
paciente inexistente, bloqueio de não-admin nos dados da empresa, listagem com e sem cancelados,
cancelamento, tentativa de cancelar duas vezes e recusa de emissão sem empresa cadastrada.

O layout impresso foi renderizado e conferido em dois cenários: recibo completo com duas vias e
recibo mínimo (só razão social, sem CPF, sem forma de pagamento) já cancelado.

**Não foi rodado `npm install` nem o build do Vite** — vale rodar `npm run dev` e testar o fluxo
antes de mostrar ao cliente.

---

## 6. Sobre o exemplo enviado (Receita Saúde)

O PDF de exemplo é um comprovante do **Receita Saúde**, do app do Carnê-Leão: quem gera é a Receita
Federal, vinculado ao CPF do profissional. Nenhum sistema de terceiros emite esse documento.

O que este módulo emite é o recibo próprio da clínica, com os mesmos dados essenciais (pagador,
beneficiário, profissional com CRO, valor, data e descrição do atendimento). Se o cliente quiser
agilizar o preenchimento do Receita Saúde, o passo seguinte seria exportar os recebimentos do
período em planilha, no formato que o Carnê-Leão aceita para lançamento.
