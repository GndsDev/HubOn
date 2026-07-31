# Pedidos e fluxo de preparo

## Rascunho

`POST /api/orders` cria um pedido `CREATED` com itens `DRAFT`. Antes da
confirmação é possível substituir quantidade, variação, escolhas e observação
com `PUT /api/orders/{id}`. O preço vem do backend e nenhum estoque é movido.

## Confirmação

`POST /api/orders/{id}/confirm` executa em uma transação:

1. bloqueia o pedido e valida a comanda aberta;
2. revalida produto, categoria, variação, disponibilidade e escolhas;
3. valida e bloqueia estoques automáticos;
4. registra as baixas `SALE`;
5. coloca itens de preparo em `WAITING_PREPARATION`;
6. coloca itens de entrega direta em `READY`;
7. deriva o estado global e recalcula a comanda.

Qualquer falha desfaz a confirmação inteira. Repetir a confirmação retorna o
estado atual sem nova baixa.

Para comandas `COUNTER`, `WAITING_PREPARATION` é apresentado como **Aguardando
pagamento** enquanto houver saldo. A confirmação não inicia o preparo.

## Fila de preparo

`GET /api/orders/preparation-queue` consulta no backend somente itens
`REQUIRES_PREPARATION` nos estados `WAITING_PREPARATION`, `IN_PREPARATION` ou
`READY`. A fila exibe produto, variação real, escolhas e observação.

Transições por item:

```text
DRAFT -> WAITING_PREPARATION -> IN_PREPARATION -> READY -> DELIVERED
                     \-> CANCELED
```

Itens `DIRECT_SERVICE` fazem `DRAFT -> READY` e nunca entram nessa consulta. A
consulta permanece disponível no backend por compatibilidade, mas não existe
uma tela exclusiva de Cozinha: Pedidos e Balcão são as interfaces visíveis.

## Pedidos mistos

Em um pedido com espeto e refrigerante, o refrigerante fica pronto e o espeto
entra na fila. O pedido global permanece em preparo até não haver item de
preparo pendente. Todos os itens não cancelados continuam na comanda e no
pagamento.

Pedido somente direto fica `READY` imediatamente, sem depender de preparo.

## Cancelamentos

Após confirmar, o item não é editado: usa-se cancelamento com motivo. O item é
marcado `CANCELED`, sai da fila e recebe autor/data. Baixas automáticas geram
estorno idempotente. Cancelar o pedido aplica a regra a todos os itens na mesma
transação.

## Snapshots

O item preserva nomes de produto, variação e categoria, fluxo, preço unitário,
quantidade, observação e escolhas. Mudanças no catálogo não reescrevem o
histórico.

## Limites do MVP

Não há impressão de produção, divisão por praça, tempos prometidos, WebSocket,
delivery, expedição separada ou reabertura de pedido pago/fechado.

## Canal de balcão

Pedidos de balcão usam as mesmas transições por item, mas o primeiro avanço dos
itens `REQUIRES_PREPARATION` é automático. Pagamento parcial não altera o
preparo. Quando o saldo chega a zero, `PaymentService` registra o pagamento e,
na mesma transação, move apenas itens elegíveis de `WAITING_PREPARATION` para
`IN_PREPARATION`, recalculando os pedidos. Falha no preparo desfaz o pagamento.

Itens diretos, cancelados, prontos, entregues ou já em preparo não são alterados.
A operação é idempotente. Em comandas `TABLE`, o fluxo anterior é preservado e
não recebe essa automação silenciosamente.
