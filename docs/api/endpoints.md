# Endpoints do HubOn MVP

> O Estoque Inteligente possui a primeira etapa implementada: ingredientes,
> movimentacoes manuais, historico auditavel e ficha tecnica de produtos.

Base local: `http://localhost:8080/api`

Todos os controllers retornam DTOs. Erros de validação, negócio e recursos não
encontrados usam o formato JSON descrito ao final.

## Autenticação

| Método | Endpoint | Descrição |
| --- | --- | --- |
| POST | `/auth/login` | Autentica usuário e retorna JWT, expiração e dados do usuário. |
| GET | `/auth/me` | Retorna o usuário autenticado atual sem expor senha. |
| PATCH | `/auth/change-password` | Altera a senha do usuário autenticado após validar a senha atual. |

Payload:

```json
{
  "email": "email-configurado-no-seeder",
  "password": "senha-configurada-no-seeder"
}
```

Endpoints protegidos exigem:

```http
Authorization: Bearer <token>
```

Payload de alteração de senha:

```json
{
  "currentPassword": "senha-atual",
  "newPassword": "nova-senha-forte",
  "confirmPassword": "nova-senha-forte"
}
```

A nova senha deve ter pelo menos 8 caracteres, letra, número e caractere
especial. Ao alterar a senha pela interface, a sessão é encerrada e o usuário
deve entrar novamente.

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
| Estoque | `OWNER`, `ADMIN` alteram; `CASHIER`, `WAITER` e `KITCHEN` consultam |
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

## Estoque - ingredientes

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/ingredients` | Lista ingredientes por nome. |
| GET | `/ingredients/active` | Lista apenas ingredientes ativos. |
| GET | `/ingredients/alerts` | Lista ingredientes ativos zerados ou abaixo/iguais ao estoque minimo. |
| GET | `/ingredients/{id}` | Busca um ingrediente. |
| POST | `/ingredients` | Cria ingrediente com saldo inicial `0`. |
| PUT | `/ingredients/{id}` | Atualiza cadastro, unidade, minimo, ideal e status; nao aceita saldo atual. |
| PATCH | `/ingredients/{id}/activate` | Ativa um ingrediente. |
| PATCH | `/ingredients/{id}/deactivate` | Desativa sem apagar historico. |

Unidades aceitas: `KG`, `G`, `L`, `ML`, `UN`, `CX`, `PACKAGE` e `TRAY`.
O status retornado e calculado:

| Condicao | `stockStatus` |
| --- | --- |
| `currentStock == 0` | `OUT_OF_STOCK` |
| `currentStock <= minimumStock` | `LOW_STOCK` |
| `currentStock > minimumStock` | `NORMAL` |

Regras principais: nome unico ignorando maiusculas/minusculas, quantidades nao
negativas, estoque ideal maior ou igual ao minimo e alteracao de saldo apenas
por movimentacoes.

## Estoque - movimentacoes

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/inventory-movements` | Lista as 100 movimentacoes mais recentes. |
| GET | `/inventory-movements/ingredient/{ingredientId}` | Lista o historico recente de um ingrediente. |
| POST | `/inventory-movements/entries` | Registra entrada manual. |
| POST | `/inventory-movements/exits` | Registra saida manual. |
| POST | `/inventory-movements/losses` | Registra perda com motivo. |
| POST | `/inventory-movements/adjustments` | Ajusta o saldo fisico encontrado com motivo. |

Tipos persistidos: `ENTRY`, `EXIT`, `LOSS`, `ADJUSTMENT` e `REVERSAL`. O fluxo
automatico de estorno ainda nao esta implementado.

Toda movimentacao grava ingrediente, tipo, quantidade, saldo anterior, saldo
resultante, motivo, usuario autenticado e data. Entradas somam; saidas e perdas
subtraem; ajustes gravam o novo saldo fisico e a diferenca absoluta como
quantidade movimentada. Nenhum movimento manual pode deixar saldo negativo.

## Ficha tecnica

Base: `/products/{productId}/ingredients`

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/products/{productId}/ingredients` | Retorna a ficha tecnica completa do produto. |
| POST | `/products/{productId}/ingredients` | Adiciona ingrediente a ficha. |
| PUT | `/products/{productId}/ingredients/{ingredientId}` | Atualiza a quantidade de um ingrediente da ficha. |
| DELETE | `/products/{productId}/ingredients/{ingredientId}` | Remove ingrediente da ficha. |
| PUT | `/products/{productId}/ingredients` | Substitui a ficha completa em uma transacao. |

Produto e ingrediente devem estar ativos para alterar a ficha. Um ingrediente
nao pode aparecer duas vezes no mesmo produto. A unidade consumida e a unidade
do proprio ingrediente; nao ha conversao automatica nesta etapa.

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
