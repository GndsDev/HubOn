# Modelo de dados do HubOn

## Visão geral

O HubOn usa PostgreSQL, Flyway e `spring.jpa.hibernate.ddl-auto=validate`. O
catálogo separa produto base, variação vendável, escolhas e vínculo opcional de
estoque.

```text
categories -> products -> product_variants -> product_stock_links -> ingredients
                    |-> product_option_groups -> product_options

restaurant_tables -> tabs -> orders -> order_items -> order_item_options
                          |-> payments       |-> inventory_movements
```

## Catálogo

### `products`

Produto comercial sem preço. Campos principais:

- `category_id`, `name`, `description` e `image_url`;
- `preparation_flow`: `REQUIRES_PREPARATION` ou `DIRECT_SERVICE`;
- `active`: permanência no catálogo;
- `available`: disponibilidade temporária para venda;
- `display_order`, `created_at` e `updated_at`.

O nome é único por categoria sem diferenciar maiúsculas e minúsculas. Um
produto só é vendável quando produto, categoria e uma variação estão ativos e
disponíveis. Produto incompleto pode permanecer cadastrado.

### `product_variants`

Unidade vendável e única fonte do preço comercial:

- `product_id`, `name`, `sku` e `price`;
- `active`, `available` e `display_order`;
- `created_at` e `updated_at`.

O nome é único dentro do produto. `price` usa `NUMERIC(10,2)` e não pode ser
negativo.

### `product_option_groups` e `product_options`

Os grupos guardam `required`, `minimum_selections`, `maximum_selections`,
`display_order` e `active`. As opções guardam nome, `additional_price`, ordem e
estado. O preço adicional é somado ao preço unitário e congelado no pedido.

## Operação

### `restaurant_tables`, `tabs` e `payments`

Mesas usam `AVAILABLE`, `OCCUPIED`, `RESERVED` ou `DISABLED`. Comandas usam
`OPEN`, `CLOSED` ou `CANCELLED`; o índice parcial
`uq_tabs_one_open_per_table` impede duas comandas abertas por mesa. Pagamentos
registram método, valor, data e usuário autenticado.

### `orders`

O pedido pertence a uma comanda e registra tipo, autor, observação,
`confirmed_at`, motivo e autor do cancelamento. Estados globais existentes:

- `CREATED` para rascunho;
- `SENT_TO_KITCHEN` e `PREPARING` quando há preparo pendente;
- `READY`, `DELIVERED` e `CANCELLED`.

O estado global é derivado dos itens; ele não substitui o estado operacional de
cada item.

### `order_items`

Cada item referencia obrigatoriamente `product_variant_id` e preserva:

- `product_name_snapshot` e `product_variant_name_snapshot`;
- `category_name_snapshot` e `preparation_flow_snapshot`;
- `unit_price_snapshot`, `quantity`, `notes` e `subtotal`;
- `status`, motivo, instante e autor de cancelamento.

Estados: `DRAFT`, `WAITING_PREPARATION`, `IN_PREPARATION`, `READY`,
`DELIVERED` e `CANCELED`.

### `order_item_options`

Registra `product_option_id` quando ainda disponível e congela
`group_name_snapshot`, `option_name_snapshot` e `additional_price_snapshot`.
Alterações posteriores no catálogo não reescrevem pedidos antigos.

## Estoque

### `ingredients`

Item de estoque com unidade (`KG`, `G`, `L`, `ML`, `UN`, `CX`, `PACKAGE` ou
`TRAY`), modo `MANUAL` ou `DIRECT_SALE`, saldo atual, mínimo, ideal e estado.
Quantidades usam `NUMERIC(15,3)` e não podem ser negativas.

### `product_stock_links`

Vínculo opcional entre `product_variant_id` e `stock_item_id`, com
`quantity_per_sale` e `active`. Um índice parcial permite no máximo um vínculo
ativo por variação. O item vinculado deve ser `DIRECT_SALE`.

### `inventory_movements`

Ledger imutável com item, tipo, quantidade, saldo anterior/resultante, motivo,
usuário, origem, pedido, item do pedido e data. Tipos:

- `ENTRY`, `EXIT`, `LOSS` e `ADJUSTMENT` para operação manual;
- `SALE` para baixa automática na confirmação;
- `REVERSAL` para estorno de cancelamento.

`uq_inventory_movements_order_item_sale` impede duas baixas `SALE` para o mesmo
item do pedido e item de estoque. O índice de reversão já existente impede
estorno duplicado.

## Identidade e auditoria

`users`, `roles` e `user_roles` sustentam JWT e autorização. Perfis atuais:
`OWNER`, `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`. Autores de pedidos,
pagamentos, cancelamentos e movimentações são obtidos da autenticação; IDs
enviados pelo cliente não são fonte de verdade.

## Totais

```text
item.unit_price_snapshot = variant.price + soma(option.additional_price)
item.subtotal = item.unit_price_snapshot * quantity
tab.total_amount = soma de itens que não sejam DRAFT ou CANCELED
tab.final_amount = max(total_amount + service_fee - discount_amount, 0)
```

## Migrations

- `V1`: operação inicial;
- `V2`: primeira estrutura de estoque;
- `V3`: controle híbrido, origem do ledger e vínculos;
- `V4`: variações e migração inicial de preço/referências;
- `V5`: correção consolidada de catálogo, opções, disponibilidade, estados por
  item, `SALE`, cancelamentos e remoção segura do preço de `products`.

`V1` a `V4` já estavam versionadas e foram preservadas. A correção entrou em
`V5`, sem editar migrations aplicadas. Mudanças futuras exigem nova versão.

## Fora do MVP

Não há ficha técnica culinária, rendimento cru/cozido, produção, compras,
fornecedores, lote, validade, múltiplos depósitos, custo médio, delivery ou
integração fiscal.
