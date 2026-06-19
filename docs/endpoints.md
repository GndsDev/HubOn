# Endpoints do HubOn MVP

Base local: `http://localhost:8080/api`

Todos os controllers retornam DTOs. Erros de validação, negócio e recursos não
encontrados usam o formato JSON descrito ao final.

## Autenticação

| Método | Endpoint | Descrição |
| --- | --- | --- |
| POST | `/auth/login` | Autentica usuário e retorna JWT, expiração e dados do usuário. |

Payload:

```json
{
  "email": "owner@hubon.local",
  "password": "owner123"
}
```

Endpoints protegidos exigem:

```http
Authorization: Bearer <token>
```

## Perfis e usuários

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/roles` | Lista `OWNER`, `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`. |
| GET | `/users` | Lista usuários locais e seus perfis. |
| POST | `/users` | Cria usuário respeitando a hierarquia de permissões. |

`OWNER` cria `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`. `ADMIN` cria somente
`WAITER`, `KITCHEN` e `CASHIER`. Roles operacionais não criam usuários.

## Acesso por perfil

| Módulo | Perfis |
| --- | --- |
| Dashboard | `OWNER`, `ADMIN` |
| Mesas | `OWNER`, `ADMIN`, `WAITER` |
| Comandas | `OWNER`, `ADMIN`, `WAITER`, `CASHIER` |
| Pedidos | `OWNER`, `ADMIN`, `WAITER` |
| Cozinha | `OWNER`, `ADMIN`, `KITCHEN` |
| Caixa | `OWNER`, `ADMIN`, `CASHIER` |
| Categorias | `OWNER`, `ADMIN` |
| Produtos | `OWNER`, `ADMIN` |
| Usuários | `OWNER`, `ADMIN` |
| Relatórios | `OWNER`, `ADMIN` |

## Categorias

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/categories` | Lista categorias. |
| GET | `/categories/{id}` | Busca uma categoria. |
| POST | `/categories` | Cria uma categoria. |
| PUT | `/categories/{id}` | Atualiza uma categoria. |
| PATCH | `/categories/{id}/activate` | Ativa uma categoria. |
| PATCH | `/categories/{id}/deactivate` | Desativa sem apagar histórico. |

## Produtos

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/products` | Lista produtos. |
| GET | `/products/{id}` | Busca um produto. |
| POST | `/products` | Cria um produto. |
| PUT | `/products/{id}` | Atualiza um produto. |
| PATCH | `/products/{id}/activate` | Ativa um produto. |
| PATCH | `/products/{id}/deactivate` | Desativa um produto. |

## Mesas

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/tables` | Lista mesas por número. |
| GET | `/tables/{id}` | Busca uma mesa. |
| POST | `/tables` | Cria uma mesa. |
| PUT | `/tables/{id}` | Atualiza uma mesa. |
| PATCH | `/tables/{id}/status` | Atualiza manualmente `AVAILABLE`, `RESERVED` ou `DISABLED`; `OCCUPIED` é exclusivo do ciclo da comanda. |
| GET | `/tables/{tableId}/current-tab` | Busca a comanda aberta da mesa. |

Não existe exclusão definitiva de mesa no MVP.

## Comandas

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/tabs/open` | Lista comandas abertas. |
| GET | `/tabs/{id}` | Retorna totais, valor pago e saldo. |
| POST | `/tabs/open` | Abre comanda em uma mesa livre. |
| POST | `/tabs/{id}/close` | Fecha somente com pagamento completo. |
| POST | `/tabs/{id}/cancel` | Cancela uma comanda aberta. |

O fechamento exige pedidos finalizados e pagamento exatamente igual ao valor
final. O cancelamento é rejeitado quando há pagamento, pedido entregue ou pedido
pendente.

## Pedidos e cozinha

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/orders` | Lista pedidos com seus itens. |
| GET | `/orders/{id}` | Busca um pedido. |
| POST | `/orders` | Cria pedido com um ou mais itens. |
| POST | `/orders/{id}/send-to-kitchen` | Avança `CREATED` para `SENT_TO_KITCHEN`. |
| PATCH | `/orders/{id}/status` | Avança uma etapa válida da cozinha. |
| POST | `/orders/{id}/cancel` | Cancela um pedido ainda não entregue. |

`GET /orders` retorna os 100 pedidos mais recentes. Cancelamento é rejeitado
quando o pedido foi entregue ou quando a comanda já possui pagamento.

## Pagamentos

| Método | Endpoint | Descrição |
| --- | --- | --- |
| POST | `/payments` | Registra pagamento em uma comanda aberta. |
| GET | `/payments/tab/{tabId}` | Retorna total, pago, restante e histórico. |

Métodos aceitos: `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `PIX` e `VOUCHER`.

O valor deve ser maior que zero e não pode ultrapassar o saldo restante. A
comanda é bloqueada durante a transação para proteger pagamentos concorrentes.

## Dashboard

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/dashboard/summary` | Retorna os indicadores e resumos operacionais do MVP. |

## Erros

```json
{
  "message": "Descrição do erro",
  "status": 400,
  "timestamp": "2026-06-10T08:30:00"
}
```

Status mais comuns:

- `400`: validação ou regra de negócio.
- `401`: token ausente, inválido, expirado ou credenciais inválidas.
- `403`: usuário autenticado sem perfil permitido.
- `404`: recurso não encontrado.
- `409`: violação de integridade ou conflito de atualização concorrente.
- `500`: erro não tratado, sem exposição de detalhes internos.
