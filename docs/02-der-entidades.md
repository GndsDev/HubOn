# DER e Entidades - MesaFlow

## Fluxo principal do sistema

Mesa → Comanda → Pedido → Itens do Pedido → Pagamento

## Entidades principais

### 1. RestaurantTable

Representa uma mesa física do restaurante.

Campos:

- id
- number
- name
- status
- active
- created_at
- updated_at

Status possíveis:

- AVAILABLE
- OCCUPIED
- RESERVED
- DISABLED

Regra:

Uma mesa só pode ter uma comanda aberta por vez.

---

### 2. Tab

Representa a comanda aberta em uma mesa.

Campos:

- id
- table_id
- status
- opened_by_user_id
- opened_at
- closed_at
- total_amount
- service_fee
- discount_amount
- final_amount

Status possíveis:

- OPEN
- CLOSED
- CANCELLED

Regra:

Comanda fechada ou cancelada não pode receber pedidos.

---

### 3. Category

Representa uma categoria do cardápio.

Campos:

- id
- name
- description
- active
- display_order

Exemplos:

- Bebidas
- Lanches
- Pratos executivos
- Sobremesas

---

### 4. Product

Representa um produto do cardápio.

Campos:

- id
- category_id
- name
- description
- price
- active
- image_url
- created_at
- updated_at

Regra:

Produto inativo não pode ser vendido.

---

### 5. Order

Representa um pedido feito pelo garçom.

Campos:

- id
- tab_id
- status
- type
- created_by_user_id
- created_at
- updated_at
- notes

Status possíveis:

- CREATED
- SENT_TO_KITCHEN
- PREPARING
- READY
- DELIVERED
- CANCELLED

---

### 6. OrderItem

Representa um item dentro do pedido.

Campos:

- id
- order_id
- product_id
- product_name_snapshot
- unit_price_snapshot
- quantity
- notes
- status
- subtotal

Regra importante:

O preço do produto deve ser salvo no item do pedido no momento da venda.

Assim, se o preço do produto mudar depois, o histórico da venda continua correto.

---

### 7. Payment

Representa um pagamento feito pelo cliente.

Campos:

- id
- tab_id
- method
- amount
- paid_at
- received_by_user_id

Métodos:

- CASH
- CREDIT_CARD
- DEBIT_CARD
- PIX
- VOUCHER

---

### 8. User

Representa um funcionário que usa o sistema.

Campos:

- id
- name
- email
- password
- active
- created_at
- updated_at

---

### 9. Role

Representa o perfil de acesso.

Campos:

- id
- name
- description

Perfis:

- ADMIN
- WAITER
- KITCHEN
- CASHIER

---

## Relacionamentos

users N:N roles

restaurant_tables 1:N tabs

tabs 1:N orders

orders 1:N order_items

products 1:N order_items

categories 1:N products

tabs 1:N payments

users 1:N orders

users 1:N payments