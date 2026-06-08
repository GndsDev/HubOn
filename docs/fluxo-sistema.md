# Fluxo do Sistema HubOn

## Fluxo principal

1. O operador cadastra ou seleciona uma mesa disponivel.
2. O operador abre uma comanda para a mesa.
3. A mesa muda automaticamente para `OCCUPIED`.
4. O garcom cria pedidos vinculados a comanda.
5. Cada item do pedido congela nome e preco do produto no momento da venda.
6. O pedido pode ser enviado para a cozinha.
7. A cozinha evolui o pedido por status: criado, enviado, preparando, pronto e entregue.
8. O caixa registra pagamentos da comanda.
9. Quando o pagamento cobre o valor final, a comanda pode ser fechada.
10. Ao fechar a comanda, a mesa volta para `AVAILABLE`.

## Status principais

Mesas:

- `AVAILABLE`: mesa disponivel.
- `OCCUPIED`: mesa com comanda aberta.
- `RESERVED`: mesa reservada.
- `DISABLED`: mesa desativada.

Comandas:

- `OPEN`: comanda aberta.
- `CLOSED`: comanda fechada.
- `CANCELLED`: comanda cancelada.

Pedidos:

- `CREATED`: pedido criado.
- `SENT_TO_KITCHEN`: pedido enviado para cozinha.
- `PREPARING`: pedido em preparo.
- `READY`: pedido pronto.
- `DELIVERED`: pedido entregue.
- `CANCELLED`: pedido cancelado.

## Carga inicial

Ao iniciar, o backend garante os perfis:

- `ADMIN`
- `WAITER`
- `KITCHEN`
- `CASHIER`

Tambem cria um usuario local de operacao quando ainda nao existe:

- Email: `admin@hubon.local`
- Senha registrada: `admin123`

Para facilitar testes, quando o catalogo e as mesas estao vazios, o backend cria categorias, produtos e oito mesas iniciais.
