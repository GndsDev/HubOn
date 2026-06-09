# Endpoints do HubOn MVP

Base local: `http://localhost:8080/api`

## Consulta e cadastros

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/roles` | Lista os perfis do sistema. |
| GET | `/users` | Lista os usuários locais disponíveis para a operação. |
| GET | `/categories` | Lista categorias. |
| GET | `/categories/{id}` | Busca uma categoria. |
| POST | `/categories` | Cria uma categoria. |
| PUT | `/categories/{id}` | Atualiza uma categoria. |
| PATCH | `/categories/{id}/activate` | Ativa uma categoria. |
| PATCH | `/categories/{id}/deactivate` | Desativa uma categoria. |
| GET | `/products` | Lista produtos. |
| GET | `/products/{id}` | Busca um produto. |
| POST | `/products` | Cria um produto. |
| PUT | `/products/{id}` | Atualiza um produto. |
| PATCH | `/products/{id}/activate` | Ativa um produto. |
| PATCH | `/products/{id}/deactivate` | Desativa um produto. |
| GET | `/tables` | Lista mesas. |
| GET | `/tables/{id}` | Busca uma mesa. |
| POST | `/tables` | Cria uma mesa. |
| PUT | `/tables/{id}` | Atualiza uma mesa. |
| PATCH | `/tables/{id}/status` | Atualiza o status da mesa. |
| GET | `/tables/{tableId}/current-tab` | Busca a comanda aberta da mesa. |

## Comandas, pedidos e pagamentos

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/tabs/open` | Lista comandas abertas. |
| GET | `/tabs/{id}` | Busca uma comanda. |
| POST | `/tabs/open` | Abre uma comanda para uma mesa disponível. |
| POST | `/tabs/{id}/close` | Fecha uma comanda com pagamento completo. |
| POST | `/tabs/{id}/cancel` | Cancela uma comanda aberta. |
| GET | `/orders` | Lista pedidos. |
| GET | `/orders/{id}` | Busca um pedido. |
| POST | `/orders` | Cria um pedido com um ou mais itens. |
| POST | `/orders/{id}/send-to-kitchen` | Envia um pedido criado para a cozinha. |
| PATCH | `/orders/{id}/status` | Avança o status do pedido. |
| POST | `/orders/{id}/cancel` | Cancela um pedido não entregue. |
| POST | `/payments` | Registra pagamento em uma comanda aberta. |
| GET | `/payments/tab/{tabId}` | Retorna total, pago, restante e histórico de pagamentos. |

## Dashboard

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/dashboard/summary` | Retorna vendas do dia, comandas abertas, pedidos em preparo, ticket médio, produtos mais vendidos, mesas, caixa e pedidos recentes. |

## Erros

Erros de validação, negócio e recursos não encontrados usam o mesmo formato:

```json
{
  "message": "Descrição do erro",
  "status": 400,
  "timestamp": "2026-06-09T10:00:00"
}
```
