# Endpoints do HubOn MVP

> O Estoque Inteligente possui controle hibrido: itens manuais, itens de baixa
> automatica, historico auditavel e vinculo simples produto-estoque.

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
| POST | `/products` | Cria um produto base sem preco. |
| PUT | `/products/{id}` | Atualiza produto base, categoria, status e fluxo de preparo. |
| PATCH | `/products/{id}/activate` | Ativa um produto. |
| PATCH | `/products/{id}/deactivate` | Desativa um produto. |
| GET | `/products/{productId}/variants` | Lista variacoes do produto. |
| POST | `/products/{productId}/variants` | Cria variacao vendavel com nome, SKU, preco e status. |
| GET | `/products/{productId}/variants/{variantId}` | Busca uma variacao do produto. |
| PUT | `/products/{productId}/variants/{variantId}` | Atualiza nome, SKU, preco e status da variacao. |
| PATCH | `/products/{productId}/variants/{variantId}/activate` | Ativa uma variacao. |
| PATCH | `/products/{productId}/variants/{variantId}/deactivate` | Desativa uma variacao. |

## Estoque - ingredientes

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/ingredients` | Lista ingredientes por nome. |
| GET | `/ingredients/active` | Lista apenas ingredientes ativos. |
| GET | `/ingredients/alerts` | Lista ingredientes ativos zerados ou abaixo/iguais ao estoque minimo. |
| GET | `/ingredients/{id}` | Busca um ingrediente. |
| POST | `/ingredients` | Cria ingrediente com saldo inicial `0` e `controlMode` padrao `MANUAL`. |
| PUT | `/ingredients/{id}` | Atualiza cadastro, unidade, modo, minimo, ideal e status; nao aceita saldo atual. |
| PATCH | `/ingredients/{id}/activate` | Ativa um ingrediente. |
| PATCH | `/ingredients/{id}/deactivate` | Desativa sem apagar historico. |

Unidades aceitas: `KG`, `G`, `L`, `ML`, `UN`, `CX`, `PACKAGE` e `TRAY`.
O status retornado e calculado:

| Condicao | `stockStatus` |
| --- | --- |
| `currentStock == 0` | `OUT_OF_STOCK` |
| `currentStock <= minimumStock` | `LOW_STOCK` |
| `currentStock > minimumStock` | `NORMAL` |

`controlMode` aceita `MANUAL` e `DIRECT_SALE`. Regras principais: nome unico
ignorando maiusculas/minusculas, quantidades nao negativas, estoque ideal maior
ou igual ao minimo e alteracao de saldo apenas por movimentacoes.

## Estoque - movimentacoes

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/inventory-movements` | Lista as 100 movimentacoes mais recentes. |
| GET | `/inventory-movements/ingredient/{ingredientId}` | Lista o historico recente de um ingrediente. |
| POST | `/inventory-movements/entries` | Registra entrada manual. |
| POST | `/inventory-movements/exits` | Registra saida manual. |
| POST | `/inventory-movements/losses` | Registra perda com motivo. |
| POST | `/inventory-movements/adjustments` | Ajusta o saldo fisico encontrado com motivo. |

Tipos persistidos: `ENTRY`, `EXIT`, `LOSS`, `ADJUSTMENT` e `REVERSAL`.
Movimentos automaticos usam `originType` (`ORDER_ITEM` ou
`ORDER_CANCELLATION`) e referenciam pedido e item do pedido.

Toda movimentacao grava ingrediente, tipo, quantidade, saldo anterior, saldo
resultante, motivo, usuario autenticado e data. Entradas somam; saidas e perdas
subtraem; ajustes gravam o novo saldo fisico e a diferenca absoluta como
quantidade movimentada. Nenhum movimento manual pode deixar saldo negativo.

## Vinculo variacao-estoque

Base: `/product-variants/{variantId}/stock-link`

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/product-variants/{variantId}/stock-link` | Retorna o vinculo ativo. |
| POST | `/product-variants/{variantId}/stock-link` | Cria vinculo ativo. |
| PUT | `/product-variants/{variantId}/stock-link` | Atualiza o vinculo ativo. |
| DELETE | `/product-variants/{variantId}/stock-link` | Desativa o vinculo ativo. |

Payload:

```json
{
  "stockItemId": 10,
  "quantityPerSale": 1
}
```

O item deve estar ativo e em `DIRECT_SALE`. A variacao, o produto base e a
categoria devem estar ativos. Existe no maximo um vinculo ativo por variacao.

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

`GET /orders` retorna os 100 pedidos mais recentes. Itens `KITCHEN` entram na
cozinha e baixam estoque ao enviar para producao. Itens `DIRECT_SERVICE` nao
entram na cozinha, ficam prontos imediatamente e baixam estoque na criacao do
pedido quando a variacao possui vinculo ativo. Cancelamento estorna baixas
automaticas uma unica vez quando o pedido ainda e elegivel. Cancelamento e
rejeitado quando o pedido foi entregue ou quando a comanda ja possui pagamento.

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
