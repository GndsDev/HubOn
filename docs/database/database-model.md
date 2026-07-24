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

### `ingredients`

Insumos controlados pelo Estoque Inteligente.

Campos principais:

- `id`
- `name`, unico por `lower(name)`
- `description`
- `unit`
- `control_mode`
- `current_stock`
- `minimum_stock`
- `ideal_stock`
- `active`
- `created_at`
- `updated_at`

Unidades: `KG`, `G`, `L`, `ML`, `UN`, `CX`, `PACKAGE` e `TRAY`.
Modos: `MANUAL` e `DIRECT_SALE`; o padrao e `MANUAL`.
`current_stock`, `minimum_stock` e `ideal_stock` usam `NUMERIC(15, 3)`.
O banco impede quantidades negativas e garante `ideal_stock >= minimum_stock`.
O saldo atual e cache operacional atualizado junto com o ledger de
movimentacoes.

### `inventory_movements`

Ledger auditavel de alteracoes de estoque.

Campos principais:

- `id`
- `ingredient_id`
- `type`
- `quantity`
- `previous_stock`
- `resulting_stock`
- `reason`
- `origin_type`
- `origin_reference`
- `order_id`
- `order_item_id`
- `user_id`
- `created_at`

Tipos: `ENTRY`, `EXIT`, `LOSS`, `ADJUSTMENT` e `REVERSAL`. Origens automaticas
usam `ORDER_ITEM` para baixa por pedido e `ORDER_CANCELLATION` para estorno. O
banco exige quantidade positiva e saldos anterior/resultante nao negativos.

Indices principais:

- `idx_inventory_movements_ingredient_created_at`
- `idx_inventory_movements_type_created_at`
- `idx_inventory_movements_user_created_at`
- `idx_inventory_movements_created_at`
- `idx_inventory_movements_order_created_at`
- `idx_inventory_movements_order_item`
- `uq_inventory_movements_order_item_exit`
- `uq_inventory_movements_order_item_reversal`

### `product_stock_links`

Vinculo simples entre produtos vendidos e itens de estoque de baixa automatica.

Campos principais:

- `id`
- `product_id`
- `stock_item_id`
- `quantity_per_sale`
- `active`
- `created_at`
- `updated_at`

O indice parcial `uq_product_stock_links_active_product` garante no maximo um
vinculo ativo por produto. A quantidade por venda deve ser maior que zero. O
item referenciado fica em `ingredients` e deve ser validado pela aplicacao como
`DIRECT_SALE`.

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
products 1:N product_stock_links
ingredients 1:N product_stock_links
ingredients 1:N inventory_movements
users 1:N inventory_movements   user_id
orders 1:N inventory_movements  order_id
order_items 1:N inventory_movements order_item_id
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

## Evolucao planejada: Estoque Inteligente

A primeira etapa do estoque foi criada na migration
`V2__add_stock_module.sql`, com `ingredients`, `inventory_movements` e
`product_ingredients`. A migration `V3__hybrid_stock_control.sql` adiciona
`control_mode`, campos de origem no ledger, `product_stock_links` e remove a
tabela `product_ingredients`.

Ainda nao existem tabelas de compras, fornecedores, lotes, validade,
financeiro, multiplos depositos, ficha tecnica, receita multi-ingrediente,
producao, rendimento ou conversao automatica de unidades. Esses pontos devem
entrar somente por novas migrations Flyway se forem retomados.

