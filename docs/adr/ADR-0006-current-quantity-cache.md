# ADR-0006: Saldo atual junto ao ledger

Data: 2026-06-25
Status: Aceito e implementado

## Contexto

Recalcular o saldo por todo o ledger em cada tela seria desnecessariamente caro,
mas armazenar apenas a quantidade atual eliminaria rastreabilidade.

## Decisão

Manter `currentStock` no item de estoque e atualizá-lo na mesma transação que
grava o `StockMovement`. O ledger preserva a explicação histórica e o saldo
materializado atende às consultas operacionais.

## Consequências

- Leituras são simples e rápidas.
- Toda entrada, saída, perda, ajuste, venda ou reversão precisa atualizar ambos.
- Falha em qualquer parte da operação reverte a transação completa.
