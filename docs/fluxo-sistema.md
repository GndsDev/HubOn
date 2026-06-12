# Fluxo do sistema HubOn

## Fluxo principal

1. O operador ativo é selecionado na topbar.
2. O operador escolhe uma mesa livre.
3. Uma comanda é aberta para a mesa.
4. A mesa muda automaticamente para `OCCUPIED`.
5. O operador cria pedidos vinculados à comanda.
6. Cada item congela nome e preço do produto no momento da venda.
7. O pedido é enviado para a cozinha.
8. A cozinha percorre `SENT_TO_KITCHEN`, `PREPARING`, `READY` e `DELIVERED`.
9. O caixa registra um ou mais pagamentos.
10. Pedidos devem estar entregues ou cancelados antes do fechamento.
11. O pagamento total deve ser exatamente igual ao valor final.
12. A comanda é fechada e a mesa volta para `AVAILABLE`.

## Estados principais

Mesas:

- `AVAILABLE`: livre.
- `OCCUPIED`: possui comanda aberta.
- `RESERVED`: reservada.
- `DISABLED`: desativada.

Comandas:

- `OPEN`: aberta.
- `CLOSED`: fechada.
- `CANCELLED`: cancelada.

Pedidos:

- `CREATED`: criado.
- `SENT_TO_KITCHEN`: enviado para cozinha.
- `PREPARING`: em preparo.
- `READY`: pronto.
- `DELIVERED`: entregue.
- `CANCELLED`: cancelado.

## Cancelamentos

- Pedido entregue não pode ser cancelado.
- Pedido de comanda com pagamento não pode ser cancelado.
- Comanda com pagamento não pode ser cancelada.
- Comanda com pedido entregue não pode ser cancelada.
- Pedido cancelado antes do pagamento deixa de compor o total.

## Carga inicial local

Quando o seeder local está habilitado, o backend garante os perfis:

- `ADMIN`
- `WAITER`
- `KITCHEN`
- `CASHIER`

Também cria um usuário administrador local quando ainda não existe:

```text
Email: admin@hubon.local
Senha padrão local: admin123
```

A senha pode ser substituída por `HUBON_ADMIN_PASSWORD`. Essa credencial é
somente para desenvolvimento e não deve ser usada em ambiente público.

Quando catálogo e mesas estão vazios, o seeder cria dados iniciais para teste.
