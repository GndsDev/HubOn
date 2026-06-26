# ADR-0004 Inventory Ledger

Data: 2026-06-25
Status: Aceito para implementacao futura

## Contexto

O Estoque Inteligente esta planejado para controlar insumos, receitas, baixa
automatica, compras e estornos.

## Problema

Atualizar apenas o saldo atual de um insumo nao explica por que a quantidade
mudou, dificulta auditoria e torna estornos arriscados.

## Alternativas consideradas

- Armazenar somente quantidade atual.
- Recalcular estoque a partir de pedidos e compras.
- Registrar um ledger de movimentacoes como fonte de verdade.

## Decisao

O estoque deve possuir ledger de movimentacoes como fonte oficial de historico.
Entradas, saidas, ajustes e estornos devem ser registrados como eventos
auditaveis.

## Consequencias

- O historico de estoque fica rastreavel.
- Estornos podem ser representados por movimentos inversos.
- Relatorios podem explicar origem das quantidades.
- O modelo exige cuidado transacional e regras claras de idempotencia.

## Status

Aceito para implementacao futura.

## Data

2026-06-25.
