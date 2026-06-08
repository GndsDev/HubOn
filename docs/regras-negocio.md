# Regras de Negocio do HubOn MVP

## Mesas e comandas

- Uma mesa nao pode ter mais de uma comanda aberta.
- Mesa desativada ou com status `DISABLED` nao pode abrir comanda.
- Ao abrir uma comanda, a mesa passa para `OCCUPIED`.
- Ao fechar ou cancelar uma comanda, a mesa volta para `AVAILABLE`.
- Comanda com status `CLOSED` ou `CANCELLED` nao pode receber pedidos ou pagamentos.

## Produtos e pedidos

- Produto inativo nao pode ser vendido.
- Pedido so pode ser criado em comanda aberta.
- O preco do produto e congelado no item em `unitPriceSnapshot`.
- O nome do produto e congelado no item em `productNameSnapshot`.
- O subtotal do item e calculado por `unitPriceSnapshot * quantity`.
- Pedido cancelado nao entra no total da comanda.
- Itens cancelados nao entram no total da comanda.

## Pagamentos

- Pagamento deve ter valor maior que zero.
- A soma dos pagamentos nao pode ultrapassar `finalAmount` da comanda.
- Para fechar a comanda, a soma dos pagamentos deve cobrir o valor final.

## Totais da comanda

O backend recalcula os valores principais da comanda a partir dos pedidos:

- `totalAmount`: soma dos subtotais dos itens ativos de pedidos nao cancelados.
- `serviceFee`: taxa de servico informada na abertura, com default zero.
- `discountAmount`: desconto informado na abertura, com default zero.
- `finalAmount`: `totalAmount + serviceFee - discountAmount`, nunca menor que zero.
