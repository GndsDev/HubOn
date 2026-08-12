# ADR-0004: Ledger de estoque

Data: 2026-06-25
Status: Aceito e implementado

## Contexto

O saldo atual, isoladamente, não explica entradas, vendas, perdas, ajustes e
reversões.

## Decisão

Registrar toda alteração como `StockMovement`, com tipo, delta, saldo anterior,
saldo resultante, origem, motivo quando aplicável, responsável e data. O ledger é
imutável e constitui o histórico oficial.

## Consequências

- Movimentos de venda e reversão podem ser associados ao item comercial.
- Auditoria não depende de reconstruir eventos a partir do saldo final.
- Operações automáticas e manuais obedecem às mesmas regras de consistência.
