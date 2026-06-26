# Modelo de dados do HubOn

## Visão geral

O HubOn usa PostgreSQL. O esquema é criado e versionado pelo Flyway, e os nomes
de tabelas e campos permanecem em inglês.

Fluxo central:

```text
restaurant_tables → tabs → orders → order_items
                         └────────────→ payments
```

## Tabelas

### `roles`

Perfis conhecidos pelo sistema.

Campos principais:

- `id`
- `name`, único
- `description`

Valores iniciais: `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`.

### `users`

Operadores cadastrados.

Campos principais:

- `id`
- `name`
- `email`, único
- `password`
- `active`
- `created_at`
- `updated_at`

No MVP, usuários são consultados para autoria local. Não existe autenticação
real.

### `user_roles`

Tabela associativa entre usuários e perfis.

- chave primária composta por `user_id` e `role_id`;
- relação muitos-para-muitos entre `users` e `roles`.

### `restaurant_tables`

Mesas físicas do restaurante.

Campos principais:

- `id`
- `number`, único
- `name`
- `status`
- `active`
- `created_at`
- `updated_at`

Status: `AVAILABLE`, `OCCUPIED`, `RESERVED` e `DISABLED`.

`status` representa a condição operacional. `active` representa se o cadastro
pode ser usado. A aplicação sincroniza ambos:

- `active=false` é tratado como `DISABLED`;
- `DISABLED` grava `active=false`;
- status diferente de `DISABLED` grava `active=true`;
- `OCCUPIED` é alterado apenas pelo ciclo da comanda.

### `categories`

Agrupamentos do cardápio.

Campos principais:

- `id`
- `name`
- `description`
- `active`
- `display_order`
- `created_at`
- `updated_at`

Uma categoria inativa preserva histórico, mas bloqueia novas vendas de seus
produtos.

### `products`

Produtos vendáveis.

Campos principais:

- `id`
- `category_id`
- `name`
- `description`
- `price`
- `active`
- `image_url`
- `created_at`
- `updated_at`

Cada produto pertence a uma categoria. O preço não pode ser negativo.
`image_url` permanece no contrato, mas não é exibido pela interface atual.

### `tabs`

Comandas abertas para mesas.

Campos principais:

- `id`
- `restaurant_table_id`
- `status`
- `opened_by_user_id`
- `opened_at`
- `closed_at`
- `total_amount`
- `service_fee`
- `discount_amount`
- `final_amount`
- `created_at`
- `updated_at`

Status: `OPEN`, `CLOSED` e `CANCELLED`.

O índice parcial `uq_tabs_one_open_per_table` garante no banco que uma mesa não
possua duas comandas abertas.

### `orders`

Pedidos vinculados a uma comanda.

Campos principais:

- `id`
- `tab_id`
- `status`
- `type`
- `created_by_user_id`
- `notes`
- `created_at`
- `updated_at`

Status:

- `CREATED`
- `SENT_TO_KITCHEN`
- `PREPARING`
- `READY`
- `DELIVERED`
- `CANCELLED`

Tipos previstos no banco: `TABLE`, `COUNTER` e `TAKEAWAY`. O fluxo entregue no
MVP é o atendimento por mesa.

### `order_items`

Itens que formam um pedido.

Campos principais:

- `id`
- `order_id`
- `product_id`
- `product_name_snapshot`
- `unit_price_snapshot`
- `quantity`
- `notes`
- `status`
- `subtotal`
- `created_at`
- `updated_at`

Status: `ACTIVE` e `CANCELLED`. Cancelamento individual de item está reservado
para uma versão futura.

#### Snapshots

`product_name_snapshot` e `unit_price_snapshot` congelam o nome e o preço no
momento da venda. Dessa forma:

- alteração posterior do produto não muda pedidos antigos;
- relatórios financeiros mantêm o valor vendido;
- o histórico continua legível mesmo após renomear um produto.

`subtotal` é calculado como preço congelado multiplicado pela quantidade.

### `payments`

Pagamentos registrados para uma comanda.

Campos principais:

- `id`
- `tab_id`
- `method`
- `amount`
- `paid_at`
- `received_by_user_id`
- `created_at`
- `updated_at`

Métodos: `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `PIX` e `VOUCHER`.

Uma comanda pode receber vários pagamentos. A soma não pode ultrapassar
`tabs.final_amount`. O registro de pagamento bloqueia a comanda durante a
transação para proteger operações concorrentes.

## Relacionamentos

```text
users N:N roles                 por user_roles
restaurant_tables 1:N tabs
users 1:N tabs                  opened_by_user_id
tabs 1:N orders
users 1:N orders                created_by_user_id
orders 1:N order_items
products 1:N order_items
categories 1:N products
tabs 1:N payments
users 1:N payments              received_by_user_id
```

## DER textual

```text
[roles] N ← [user_roles] → N [users]
                                │
                                ├── abre ───────────────┐
                                ├── cria pedidos ───┐   │
                                └── recebe pagamentos│   │
                                                   │   │
[restaurant_tables] 1 ── N [tabs] 1 ── N [orders] 1 ── N [order_items]
                            │                                  │
                            └──────── 1 ── N [payments]         N
                                                               │
[categories] 1 ── N [products] 1 ──────────────────────────────┘
```

## Totais financeiros

```text
total_amount = soma dos itens ativos de pedidos não cancelados
final_amount = max(total_amount + service_fee - discount_amount, 0)
paid_amount = soma dos pagamentos da comanda
remaining_amount = max(final_amount - paid_amount, 0)
```

`paid_amount` e `remaining_amount` são calculados pela aplicação; não existem
como colunas próprias na tabela `tabs`.

## Evolução do esquema

- Não usar `ddl-auto=create` ou `ddl-auto=update`.
- Manter `spring.jpa.hibernate.ddl-auto=validate`.
- Criar uma nova migration para qualquer alteração futura.
- Não editar uma migration que já tenha sido aplicada.

## Evolução planejada: Estoque Inteligente

O modelo atual ainda não contém tabelas de estoque. Para o pós-MVP, estão em
estudo `inventory_items`, `product_recipes`, `inventory_movements`, `suppliers`
e uma estrutura de entradas por compra. Essa proposta é conceitual e nenhuma
migration foi criada.

Os relacionamentos e decisões pendentes estão documentados em
[stock-management.md](../business/stock-management.md). Quando a implementação começar, o
modelo aprovado deverá entrar em uma nova migration Flyway.

