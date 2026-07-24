# ADR-0004 Inventory Ledger

Data: 2026-06-25
Status: Implementado no modulo de estoque

## Contexto

O Estoque Inteligente controla itens de estoque, movimentacoes manuais, baixa
automatica simples por venda e estornos.

## Problema

Atualizar apenas o saldo atual de um insumo nao explica por que a quantidade
mudou, dificulta auditoria e torna estornos arriscados.

## Alternativas consideradas

- Armazenar somente quantidade atual.
- Recalcular estoque a partir de pedidos e compras.
- Registrar um ledger de movimentacoes como fonte de verdade.

## Decisao

O estoque deve possuir ledger de movimentacoes como fonte oficial de historico.
Entradas, saidas, ajustes, perdas e estornos sao registrados como eventos
auditaveis, com origem manual ou referencia a pedido quando aplicavel.

## Consequencias

- O historico de estoque fica rastreavel.
- Estornos podem ser representados por movimentos inversos.
- Relatorios podem explicar origem das quantidades.
- O modelo exige cuidado transacional e regras claras de idempotencia.

## Status

Implementado para o escopo atual.

## Data

2026-06-25.
