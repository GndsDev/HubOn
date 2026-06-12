# DER e entidades do HubOn

Este arquivo permanece como índice histórico da modelagem.

O modelo completo, os campos, relacionamentos, snapshots e DER textual estão em:

- [database-model.md](database-model.md)

Relações centrais:

```text
restaurant_tables 1:N tabs
tabs 1:N orders
orders 1:N order_items
categories 1:N products
products 1:N order_items
tabs 1:N payments
users N:N roles
```
