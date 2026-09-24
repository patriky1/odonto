# Alterações — Orçamento (odontograma), perfil do paciente e tratamentos

Nenhuma dependência nova. A tabela `orcamento_itens` e a coluna
`tratamentos.imagens` são criadas sozinhas quando o backend sobe
(`src/database/db.js`), sem apagar dados.

## 1. Odontograma → aba "Orçamento" do paciente

- Saiu do menu lateral. Agora é a **primeira aba da ficha do paciente**
  (`/pacientes/:id`), com o nome **Orçamento**.
  O endereço antigo `/odontograma?paciente=ID` redireciona para a aba
  (o botão "Abrir" do prontuário também foi apontado para ela).
- **Mesial / distal corrigidas**: a mesial fica sempre voltada para a linha
  média. Dentes 18–11, 48–41 (e 55–51, 85–81) têm a mesial à DIREITA do
  desenho; 21–28, 31–38 (61–65, 71–75) à ESQUERDA.
- **Várias faces de uma vez**: clique nas faces do desenho (ou nos botões
  V L M D O) para marcar/desmarcar. O status é gravado em cada face
  escolhida e o orçamento recebe uma linha só (ex.: "Dente 36 (M, O, D)").
- **Procedimento vem do cadastro** (tela Procedimentos), com a opção
  "Outro (digitar)".
- **Boca inteira**: botão "Boca inteira" para lançar um procedimento sem
  dente (limpeza, clareamento...).
- **Lista do orçamento** embaixo da arcada — uma linha por procedimento:
  dente nº / status / procedimento / **preço digitado na própria linha**
  (em branco; aparece o valor da tabela como atalho) / salvar / editar /
  excluir / **Feito** (a linha fica verde e o procedimento riscado).
- **Totais**: total do orçamento, já realizado e a realizar, com aviso de
  itens sem preço. Botão **Imprimir orçamento** (com assinaturas).
- O **resumo clínico** foi para baixo do orçamento.
- Sem procedimento, o botão salva só a situação do dente no mapa
  ("Salvar no odontograma"), como antes.

## 2. Paciente

- Aba **Dados** removida. Endereço, WhatsApp, responsável e observações
  passaram para o cartão do perfil.
- Botão **Editar perfil** no topo da ficha (mesmo formulário do cadastro).

## 3. Tratamentos

- Continua dando para criar vários tratamentos por paciente, agora direto
  na aba **Tratamentos** da ficha (novo / editar / excluir).
- O formulário tem só **Descrição** + **galeria de até 10 imagens**
  (várias de uma vez, reduzidas no navegador antes do envio). Clique na
  miniatura para ampliar (setas ← → navegam).
- As fotos "antes/depois" antigas foram movidas para a galeria
  automaticamente. Imagem removida da galeria é apagada do disco.
- A tela geral **Tratamentos** (menu) usa o mesmo formulário.
- Limite do corpo JSON do backend subiu para 30 MB (galeria inteira).

## Arquivos novos

Backend: `controllers/orcamentoController.js`, `routes/orcamento.js`
(API `/api/orcamento`).

Frontend: `components/odontograma/` (`constantes.js`, `Dente.jsx`,
`OrcamentoTabela.jsx`, `SeletorProcedimento.jsx`),
`components/tratamentos/` (`TratamentoForm.jsx`, `GaleriaUpload.jsx`,
`GaleriaImagens.jsx`), `pages/Pacientes/OrcamentoPanel.jsx`,
`pages/Pacientes/TratamentosPanel.jsx`.

## Como testar rápido

1. Pacientes → abra um paciente: a aba **Orçamento** abre primeiro.
2. Clique nas faces M e O do dente 16, status "Cariado", escolha um
   procedimento → "Salvar e incluir no orçamento".
3. Digite o preço na linha → ícone de salvar (ou Enter). Marque "Feito".
4. "Boca inteira" → escolha "Limpeza" → "Incluir no orçamento".
5. Aba Tratamentos → Novo tratamento → descrição + imagens.
