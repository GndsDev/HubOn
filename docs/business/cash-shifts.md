# Turno de Caixa

## Responsabilidade

O Caixa controla o turno e o dinheiro. Ele não monta pedidos, não recebe uma
venda por um formulário próprio e não altera preparo, entrega ou fechamento de
atendimento. Pagamentos acontecem no Balcão ou na Comanda e são associados ao
turno aberto pelo backend.

## Ciclo

1. **Abrir caixa** informa o saldo inicial e registra operador e horário.
2. Pagamentos recebidos alimentam os totais do turno por método.
3. **Suprimento** adiciona dinheiro com valor, responsável e observação.
4. **Sangria** retira dinheiro com a mesma trilha de auditoria.
5. **Fechar caixa** informa o valor contado, calcula a diferença e exige
   observação quando ela não é zero.
6. O histórico preserva turnos fechados e todas as movimentações.

O saldo esperado em dinheiro considera saldo inicial, pagamentos em dinheiro,
suprimentos, sangrias, cancelamentos e estornos aplicáveis. Valores eletrônicos
são exibidos separadamente.

## Persistência

A migration `V8__cash_shifts_and_movements.sql` cria:

- `cash_shifts`, com abertura, fechamento, conferência e diferença;
- `cash_movements`, com tipo, origem, referência, responsável e observação;
- `payments.cash_shift_id`, vínculo explícito entre recebimento e turno;
- índices para turno atual, movimentações e pagamentos por data.

A busca do turno aberto usa lock pessimista. Assim, abertura, fechamento,
movimentações e associação de pagamentos não dependem de comparação imprecisa
de horários.

## Endpoints

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/api/cash-shifts/current` | Retorna o turno aberto ou `null`. |
| `GET` | `/api/cash-shifts/history` | Lista turnos para consulta. |
| `POST` | `/api/cash-shifts` | Abre o turno com saldo inicial. |
| `POST` | `/api/cash-shifts/{id}/movements` | Registra sangria ou suprimento. |
| `POST` | `/api/cash-shifts/{id}/close` | Confere e fecha o turno. |

`OWNER`, `ADMIN` e `CASHIER` podem operar o Caixa. Outros perfis recebem `403`.
