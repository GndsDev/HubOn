# ADR-0005 Inventory Consumption Lifecycle

Data: 2026-06-25
Status: Implementado no escopo hibrido

## Contexto

O HubOn baixa itens `DIRECT_SALE` automaticamente a partir de pedidos com
vinculo simples produto-estoque.

## Problema

A baixa de estoque precisa ocorrer em um momento previsivel do ciclo do pedido,
sem duplicar consumo nem impedir estornos corretos.

## Alternativas consideradas

- Baixar estoque quando o pedido e criado.
- Baixar estoque quando o pedido e enviado para a cozinha.
- Baixar estoque quando o pedido e entregue.
- Baixar estoque apenas no fechamento da comanda.

## Decisao

A baixa automatica ocorre no evento operacional `send-to-kitchen`, na transicao
`CREATED -> SENT_TO_KITCHEN`, e e registrada no ledger como `EXIT` com origem
`ORDER_ITEM`. Cancelamentos elegiveis criam `REVERSAL` com origem
`ORDER_CANCELLATION`.

## Consequencias

- O ciclo de estoque fica conectado ao ciclo operacional do pedido.
- Cancelamentos precisam conhecer se ja houve baixa.
- Reprocessamentos devem evitar consumo duplicado.
- Itens `MANUAL` permanecem fora da baixa automatica.
- O escopo nao inclui ficha tecnica, receita multi-ingrediente, producao,
  rendimento ou conversao automatica.

## Status

Implementado para o controle hibrido simples.

## Data

2026-06-25.
