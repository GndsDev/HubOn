# Caixa

## Turno

O caixa trabalha com um único `CashShift` aberto por vez. A abertura registra
responsável, data/hora e saldo inicial. O histórico retorna os 50 turnos mais
recentes.

Todo pagamento exige um turno aberto e fica vinculado a ele. As formas aceitas
são Dinheiro, PIX, Débito, Crédito e Voucher.

## Resumo financeiro

O backend devolve:

- total recebido e divisão por forma de pagamento;
- valor de itens cancelados durante o turno;
- total de suprimentos e sangrias;
- dinheiro esperado;
- valor contado, diferença e observação após o fechamento;
- lista cronológica de pagamentos, movimentos manuais e cancelamentos.

O dinheiro esperado é calculado por:

```text
saldo inicial
+ pagamentos em dinheiro
+ suprimentos
- sangrias
```

Pagamentos eletrônicos compõem o total recebido, mas não o dinheiro físico
esperado.

## Suprimento e sangria

Movimentos manuais aceitam somente `SUPPLY` ou `WITHDRAWAL`. O valor deve ser
maior que zero e a observação é obrigatória.

## Fechamento

O usuário informa o dinheiro contado. A diferença é `contado - esperado`. Quando
ela não é zero, uma observação é obrigatória. Depois de fechado, o turno não pode
receber novos movimentos.

## Cancelamentos

Cancelamentos de itens ocorridos entre abertura e fechamento aparecem no extrato
e no total informativo de cancelamentos. Eles não reduzem o dinheiro esperado,
pois itens não podem ser cancelados depois que a venda recebe pagamento.

## Limitações

Não há estorno de pagamento, reabertura de turno ou exclusão de movimentos. A
conciliação é operacional e não substitui contabilidade fiscal.
