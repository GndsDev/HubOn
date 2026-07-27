# Controle de estoque híbrido

Status: implementado para operação manual e baixa automática simples por venda.

## Modos de controle

`MANUAL` atende ingredientes e itens de consumo variável. Pedidos não alteram
seu saldo. A operação usa entrada, saída, perda e ajuste.

`DIRECT_SALE` atende bebidas e mercadorias prontas. Uma variação pode ter um
vínculo ativo com um item desse modo e informar `quantityPerSale`.

## Vínculo por variação

O vínculo pertence à `ProductVariant`, nunca ao produto base. Regras:

- no máximo um vínculo ativo por variação;
- variação, produto e item de estoque ativos;
- item obrigatoriamente `DIRECT_SALE`;
- quantidade por venda maior que zero;
- remoção apenas desativa o vínculo e preserva histórico;
- unidade não muda após existir movimentação;
- item vinculado não pode ser desativado nem convertido para `MANUAL`.

## Confirmação do pedido

A baixa automática ocorre em `POST /api/orders/{id}/confirm`, na mesma
transação da confirmação. Para cada item:

```text
quantidade movimentada = quantidade vendida * quantityPerSale
```

O serviço agrega necessidades pelo item de estoque, ordena os IDs, aplica lock
pessimista e valida todos os saldos antes de gravar. Se faltar saldo, a
confirmação inteira é revertida e a mensagem consolida os produtos afetados,
saldo disponível, necessário e unidade formatada.

Cada baixa grava `SALE`, saldos anterior/resultante, usuário autenticado,
pedido, item do pedido, motivo e origem `ORDER_ITEM`. O índice único por
`ingredient_id + order_item_id + SALE` e a validação do serviço garantem
idempotência.

O endpoint legado `send-to-kitchen` delega temporariamente para a confirmação,
mas não define mais a regra de estoque.

## Cancelamento e estorno

Cancelamento exige motivo. Uma venda automática já baixada gera `REVERSAL` com
a quantidade exata da `SALE`, usuário autenticado, pedido, item e origem
`ORDER_CANCELLATION`. A venda original permanece no ledger.

Cancelar novamente não duplica estorno. Item sem baixa apenas muda para
`CANCELED`. Cancelamento total processa todos os itens na mesma transação.
Pedidos entregues, comandas fechadas ou comandas com pagamentos seguem as
restrições financeiras existentes.

## Movimentações manuais

- `ENTRY`: aumenta o saldo;
- `EXIT`: reduz o saldo sem permitir resultado negativo;
- `LOSS`: reduz com motivo obrigatório;
- `ADJUSTMENT`: registra o saldo físico encontrado e exige motivo.

Todas usam `BigDecimal`, lock pessimista, usuário autenticado e saldos
anterior/resultante. Movimentações automáticas não têm edição ou exclusão.

## Interface

A tela mantém resumos, busca, filtros, cadastro, histórico e ações por menu de
três pontos. O menu é um overlay fixo fora da linha, calculado pelo botão:

- abre acima quando não há espaço inferior;
- limita altura e permite scroll;
- corrige posição horizontal para não sair da viewport;
- fecha por clique externo ou `Escape`;
- oferece foco visível e navegação por teclado;
- usa tokens dos temas claro e escuro.

Saída manual mostra saldo atual, quantidade e saldo previsto, bloqueando valor
superior ao disponível. Sugestões de motivo continuam editáveis.

## Unidades

O formatter central apresenta `kg`, `g`, `L`, `mL`, `UN`, `CX`, `Pacote` e
`Bandeja` sem alterar os enums persistidos.

## Limites

Não há receita multi-ingrediente, ficha técnica, produção, conversão automática
de unidades, compras, fornecedores, lotes, validade, múltiplos depósitos ou
custo médio.
