# ADR-0005 Inventory Consumption Lifecycle

Data: 2026-06-25
Status: Aceito para implementacao futura

## Contexto

O HubOn planeja baixar insumos automaticamente a partir de pedidos e receitas.

## Problema

A baixa de estoque precisa ocorrer em um momento previsivel do ciclo do pedido,
sem duplicar consumo nem impedir estornos corretos.

## Alternativas consideradas

- Baixar estoque quando o pedido e criado.
- Baixar estoque quando o pedido e enviado para a cozinha.
- Baixar estoque quando o pedido e entregue.
- Baixar estoque apenas no fechamento da comanda.

## Decisao

A baixa automatica deve ser definida como parte do ciclo operacional do pedido e
registrada no ledger. A decisao inicial orienta que o consumo seja acionado em
evento operacional documentado e idempotente, com regra explicita de estorno para
cancelamentos elegiveis.

## Consequencias

- O ciclo de estoque fica conectado ao ciclo de producao.
- Cancelamentos precisam conhecer se ja houve baixa.
- Reprocessamentos devem evitar consumo duplicado.
- A implementacao final deve atualizar regras de negocio, testes e modelo de
  dados antes de entrega.

## Status

Aceito para implementacao futura.

## Data

2026-06-25.
