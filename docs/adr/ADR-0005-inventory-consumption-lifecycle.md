# ADR-0005 Inventory Consumption Lifecycle

Data: 2026-07-27
Status: Implementado no escopo hibrido

## Contexto

O HubOn baixa itens `DIRECT_SALE` automaticamente a partir de pedidos com
vínculo simples por variação vendável.

## Problema

A baixa de estoque precisa ocorrer em um momento previsivel do ciclo do pedido,
sem duplicar consumo nem impedir estornos corretos.

## Alternativas consideradas

- Baixar estoque quando o pedido e criado.
- Baixar estoque quando o pedido é confirmado.
- Baixar estoque quando o pedido e entregue.
- Baixar estoque apenas no fechamento da comanda.

## Decisao

A baixa automática ocorre em `confirm`, independentemente de o pedido possuir
itens de cozinha, e é registrada no ledger como `SALE` com origem
`ORDER_ITEM`. O endpoint legado `send-to-kitchen` apenas delega para a
confirmação. Cancelamentos elegíveis criam `REVERSAL` com origem
`ORDER_CANCELLATION`.

## Consequencias

- O ciclo de estoque fica conectado à confirmação comercial do pedido.
- Cancelamentos precisam conhecer se ja houve baixa.
- Reprocessamentos devem evitar consumo duplicado.
- Itens `MANUAL` permanecem fora da baixa automatica.
- O escopo nao inclui ficha tecnica, receita multi-ingrediente, producao,
  rendimento ou conversao automatica.

## Status

Implementado para o controle hibrido simples.

## Data

2026-07-27.
