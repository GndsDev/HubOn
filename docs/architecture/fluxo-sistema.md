# Fluxo do sistema HubOn

## Responsabilidades

- **Balcão:** abre, monta, confirma, recebe, acompanha, entrega e finaliza vendas `COUNTER`.
- **Comandas:** abre, recebe e conclui vendas `TABLE` vinculadas a mesas.
- **Pedidos:** acompanha origem, itens, preparo e entrega; não possui pagamento próprio.
- **Caixa:** controla turno, dinheiro e movimentações; não atende clientes.
- **Relatórios:** analisa vendas já concluídas.

O HubOn não possui tela exclusiva de Cozinha. O domínio e a fila de preparo
continuam no backend; a interface usa Pedidos e Balcão.

## Venda de mesa

1. Uma mesa livre recebe uma comanda `TABLE` e muda para `OCCUPIED`.
2. Pedidos são montados e confirmados com snapshots e baixa de estoque.
3. Pedidos acompanha o preparo e a entrega por item.
4. Pagamentos parciais ou totais são registrados dentro da própria Comanda.
5. Com todos os pedidos resolvidos e saldo zero, a Comanda é fechada e a mesa
   volta para `AVAILABLE`.

## Venda de balcão

1. **Nova venda no balcão** persiste imediatamente uma comanda `COUNTER`.
2. A rota `/balcao/:id` salva e retoma itens, escolhas e observações.
3. A confirmação valida catálogo e estoque; itens diretos ficam prontos e itens
   preparados aguardam pagamento.
4. Pagamento parcial não inicia preparo.
5. Pagamento integral inicia automaticamente os itens preparados elegíveis na
   mesma transação.
6. Itens são marcados como prontos e entregues separadamente.
7. Venda paga e entregue é finalizada explicitamente.

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

- `OWNER`
- `ADMIN`
- `WAITER`
- `KITCHEN`
- `CASHIER`

Também cria usuários locais iniciais quando ainda não existem. As credenciais
vêm de propriedades configuráveis:

```text
OWNER: hubon.seed.owner.name, hubon.seed.owner.username, hubon.seed.owner.password
ADMIN: hubon.seed.admin.name, hubon.seed.admin.username, hubon.seed.admin.password
```

As senhas podem ser substituídas por `HUBON_SEED_OWNER_PASSWORD` e
`HUBON_SEED_ADMIN_PASSWORD`. Os valores padrão do perfil local são somente para
desenvolvimento e não devem ser usados em ambiente público.

Quando catálogo e mesas estão vazios, o seeder cria dados iniciais para teste.
