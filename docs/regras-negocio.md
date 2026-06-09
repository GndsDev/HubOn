# Regras de negócio do HubOn MVP

## Cadastros

- Categoria exige nome e pode ser ativada ou desativada sem apagar o histórico.
- Produto exige nome, categoria e preço maior ou igual a zero.
- Produto inativo não pode ser incluído em pedido.
- Número da mesa é obrigatório e único.
- Mesa usa `AVAILABLE`, `OCCUPIED`, `RESERVED` ou `DISABLED`.

## Mesas e comandas

- Uma mesa não pode ter mais de uma comanda aberta.
- Mesa `OCCUPIED` ou `DISABLED` não pode abrir outra comanda.
- Ao abrir comanda, a mesa muda para `OCCUPIED`.
- Enquanto houver comanda aberta, a mesa deve continuar `OCCUPIED`.
- Comanda `CLOSED` ou `CANCELLED` não recebe pedidos nem pagamentos.
- Ao fechar ou cancelar comanda, a mesa volta para `AVAILABLE`.
- O fechamento exige pagamento integral.

## Pedidos

- Pedido pertence a uma comanda aberta e começa como `CREATED`.
- O envio para cozinha muda o pedido para `SENT_TO_KITCHEN`.
- A cozinha avança sequencialmente: `SENT_TO_KITCHEN` → `PREPARING` → `READY` → `DELIVERED`.
- Pedido entregue não pode ser cancelado.
- Pedido cancelado não entra no total da comanda.
- Nome e preço são congelados em `productNameSnapshot` e `unitPriceSnapshot`.
- O subtotal é `unitPriceSnapshot * quantity`.

## Pagamentos e totais

- Pagamento deve ser maior que zero e usar `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `PIX` ou `VOUCHER`.
- A soma paga não pode ultrapassar `finalAmount`.
- `totalAmount` soma os itens ativos de pedidos não cancelados.
- `finalAmount` é `totalAmount + serviceFee - discountAmount`, nunca menor que zero.
- A consulta de pagamentos retorna `totalAmount`, `paidAmount`, `remainingAmount` e o histórico.
