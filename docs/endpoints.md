# Endpoints do HubOn MVP

Base local: `http://localhost:8080/api`

## Roles

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/roles` | Lista perfis do sistema. |

## Users

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/users` | Lista usuarios locais para operacao do MVP. |

## Categories

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/categories` | Lista categorias. |
| POST | `/categories` | Cria categoria. |
| PUT | `/categories/{id}` | Atualiza categoria. |
| PATCH | `/categories/{id}/activate` | Ativa categoria. |
| PATCH | `/categories/{id}/deactivate` | Desativa categoria. |

## Products

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/products` | Lista produtos. |
| GET | `/products/{id}` | Busca produto por id. |
| POST | `/products` | Cria produto. |
| PUT | `/products/{id}` | Atualiza produto. |
| PATCH | `/products/{id}/activate` | Ativa produto. |
| PATCH | `/products/{id}/deactivate` | Desativa produto. |

## Tables

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/tables` | Lista mesas. |
| GET | `/tables/{id}` | Busca mesa por id. |
| POST | `/tables` | Cria mesa. |
| PUT | `/tables/{id}` | Atualiza mesa. |
| PATCH | `/tables/{id}/status` | Atualiza status da mesa. |
| GET | `/tables/{tableId}/current-tab` | Busca comanda aberta da mesa. |

## Tabs

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/tabs/open` | Lista comandas abertas. |
| GET | `/tabs/{id}` | Busca comanda por id. |
| POST | `/tabs/open` | Abre comanda para uma mesa. |
| POST | `/tabs/{id}/close` | Fecha comanda apos pagamento completo. |
| POST | `/tabs/{id}/cancel` | Cancela comanda aberta. |

## Orders

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/orders` | Lista pedidos. |
| GET | `/orders/{id}` | Busca pedido por id. |
| POST | `/orders` | Cria pedido com itens. |
| POST | `/orders/{id}/send-to-kitchen` | Envia pedido criado para cozinha. |
| PATCH | `/orders/{id}/status` | Atualiza status do pedido. |
| POST | `/orders/{id}/cancel` | Cancela pedido. |

## Payments

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| POST | `/payments` | Registra pagamento em uma comanda aberta. |
| GET | `/payments/tab/{tabId}` | Lista pagamentos de uma comanda. |

## Erros

Os erros sao retornados em JSON:

```json
{
  "message": "Descricao do erro",
  "status": 400,
  "timestamp": "2026-06-08T10:00:00"
}
```
