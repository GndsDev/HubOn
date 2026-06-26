# ADR-0006 CurrentQuantity Cache

Data: 2026-06-25
Status: Aceito para implementacao futura

## Contexto

Consultas operacionais de estoque precisam mostrar rapidamente a quantidade atual
de cada insumo.

## Problema

Calcular saldo sempre a partir de todo o ledger pode ficar caro conforme o uso
cresce, mas armazenar somente o saldo atual remove a rastreabilidade.

## Alternativas consideradas

- Calcular quantidade atual sempre pelo ledger.
- Manter apenas uma coluna de quantidade atual.
- Usar ledger como fonte de verdade e uma quantidade atual como cache
  transacional.

## Decisao

Usar `currentQuantity` como cache derivado, atualizado junto com o ledger dentro
da mesma transacao. O ledger permanece a fonte de verdade historica.

## Consequencias

- Leituras operacionais ficam mais simples e rapidas.
- Inconsistencias entre cache e ledger precisam ser detectaveis.
- Ajustes e estornos devem atualizar ambos de forma transacional.
- Rotinas futuras de conciliacao podem ser necessarias.

## Status

Aceito para implementacao futura.

## Data

2026-06-25.
