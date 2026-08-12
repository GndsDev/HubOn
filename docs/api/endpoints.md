# Referência da API HTTP

Base local: `http://localhost:4200/api` pela stack Docker ou
`http://localhost:8080/api` com o backend publicado para desenvolvimento.

Exceto o login, as rotas exigem `Authorization: Bearer <token>`. Datas usam ISO
8601 e valores monetários são decimais JSON.

## Autenticação

| Método | Caminho | Corpo/resultado |
| --- | --- | --- |
| `POST` | `/auth/login` | `{ username, password }` -> token, expiração e usuário |
| `GET` | `/auth/me` | usuário autenticado |
| `PATCH` | `/auth/change-password` | `{ currentPassword, newPassword, confirmPassword }` |

## Dashboard

| Método | Caminho | Resultado |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | vendas do dia, abertas, pendências, ticket, caixa e vendas recentes |

## Vendas

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET` | `/sales?status=&type=` | lista com filtros opcionais `OPEN/CLOSED/CANCELLED` e `TABLE/COUNTER` |
| `GET` | `/sales/{id}` | detalhes, itens, pagamentos e totais derivados |
| `POST` | `/sales` | abre venda com `type`, `tableNumber`, cliente opcional, taxa e desconto |
| `POST` | `/sales/{id}/items` | adiciona `{ productId, quantity, notes, optionIds }` |
| `PATCH` | `/sales/{id}/items/{itemId}/quantity` | altera `{ quantity }` |
| `DELETE` | `/sales/{id}/items/{itemId}` | remove lançamento sem motivo |
| `POST` | `/sales/{id}/items/{itemId}/cancel` | cancela item com `{ reason }` |
| `POST` | `/sales/{id}/payments` | registra `{ method, amount, receivedByUserId? }` |
| `POST` | `/sales/{id}/close` | fecha venda integralmente quitada |
| `POST` | `/sales/{id}/cancel` | cancela venda sem pagamento com `{ reason }` |

`SaleResponse` inclui `subtotal`, `finalAmount`, `paidAmount` e
`remainingAmount`, calculados na leitura. Itens removidos não aparecem na
resposta; itens cancelados permanecem com autoria, data e motivo.

## Categorias e produtos

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET`, `POST` | `/categories` | listar e criar categorias |
| `GET`, `PUT` | `/categories/{id}` | consultar e atualizar |
| `PATCH` | `/categories/{id}/activate` | ativar |
| `PATCH` | `/categories/{id}/deactivate` | desativar |
| `GET`, `POST` | `/products` | listar e criar produtos |
| `POST` | `/products/registration` | criar produto e grupos de escolhas em conjunto |
| `GET`, `PUT` | `/products/{id}` | consultar e atualizar |
| `PATCH` | `/products/{id}/activate` | ativar |
| `PATCH` | `/products/{id}/deactivate` | desativar |
| `PATCH` | `/products/{id}/available` | disponibilizar para venda |
| `PATCH` | `/products/{id}/unavailable` | marcar indisponível |

O corpo de produto contém `categoryId?`, `name`, `description?`, `price`,
`active?`, `available?` e `displayOrder?`.

### Escolhas

Base: `/products/{productId}/option-groups`.

| Método | Sufixo | Uso |
| --- | --- | --- |
| `GET`, `POST` | `` | listar/criar grupos |
| `PUT` | `/{groupId}` | atualizar grupo |
| `PATCH` | `/{groupId}/activate` ou `/deactivate` | alterar atividade do grupo |
| `POST` | `/{groupId}/options` | criar escolha |
| `PUT` | `/{groupId}/options/{optionId}` | atualizar escolha |
| `PATCH` | `/{groupId}/options/{optionId}/activate` ou `/deactivate` | alterar atividade |

Grupo recebe `name`, `minimumSelections`, `maximumSelections`, `displayOrder?`,
`active?` e `options?`. Escolha recebe `name`, `additionalPrice?`,
`displayOrder?` e `active?`.

## Estoque

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET`, `POST` | `/stock-items` | listar e criar itens |
| `GET` | `/stock-items/active` | listar ativos |
| `GET` | `/stock-items/alerts` | listar saldos baixos ou zerados |
| `GET`, `PUT` | `/stock-items/{id}` | consultar e atualizar |
| `PATCH` | `/stock-items/{id}/activate` ou `/deactivate` | alterar atividade |
| `GET` | `/stock-movements` | até 200 movimentos recentes |
| `GET` | `/stock-movements/stock-item/{id}` | até 200 movimentos do item |
| `POST` | `/stock-movements/entries` | entrada `{ stockItemId, quantity, reason? }` |
| `POST` | `/stock-movements/exits` | saída `{ stockItemId, quantity, reason? }` |
| `POST` | `/stock-movements/losses` | perda `{ stockItemId, quantity, reason }` |
| `POST` | `/stock-movements/adjustments` | ajuste `{ stockItemId, newStock, reason }` |

### Vínculos automáticos

Em `/products/{productId}/stock-link`, `GET`, `POST`, `PUT` e `DELETE` consultam,
criam, atualizam ou desativam o vínculo do produto. O corpo é
`{ stockItemId, quantityPerSale }`.

Em
`/products/{productId}/option-groups/{groupId}/options/{optionId}/stock-link`, os
mesmos métodos cuidam do vínculo da escolha. O corpo é
`{ stockItemId, quantityPerSelection }`.

## Caixa

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET` | `/cash-shifts/current` | turno aberto; `204` quando não existe |
| `GET` | `/cash-shifts/history` | 50 turnos mais recentes |
| `GET` | `/cash-shifts/{id}` | turno e extrato |
| `POST` | `/cash-shifts` | abre com `{ openingBalance }` |
| `POST` | `/cash-shifts/{id}/movements` | `{ type: SUPPLY|WITHDRAWAL, amount, note }` |
| `POST` | `/cash-shifts/{id}/close` | `{ countedCash, note? }` |

## Relatórios

Todos aceitam `channel=ALL|TABLE|COUNTER`.

| Método | Caminho | Parâmetros |
| --- | --- | --- |
| `GET` | `/reports/daily` | `date=YYYY-MM-DD` opcional |
| `GET` | `/reports/monthly` | `year` e `month` opcionais |
| `GET` | `/reports/annual` | `year` opcional |
| `GET` | `/reports/daily/pdf`, `/monthly/pdf`, `/annual/pdf` | mesmos filtros |
| `GET` | `/reports/daily/xlsx`, `/monthly/xlsx`, `/annual/xlsx` | mesmos filtros |

Sem referência, a API usa a data atual na zona de negócio configurada.

## Usuários e perfis

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET` | `/users` | lista usuários para Dono/Gerente |
| `POST` | `/users` | Dono cria um Gerente |
| `GET` | `/roles` | lista perfis cadastrados |

O corpo de criação é `{ name, username, password, active?, roles }`. O fluxo
atual aceita exatamente o perfil `ADMIN` para novos usuários.

## Erros

Erros seguem:

```json
{
  "message": "Descrição do problema",
  "status": 400,
  "timestamp": "2026-08-12T09:00:00"
}
```

Regras e validações retornam `400`, recurso ausente `404`, conflito de
integridade/concorrência `409`, ausência de autenticação `401`, acesso negado
`403` e falha inesperada `500` com mensagem genérica.
