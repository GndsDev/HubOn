# Controle de Estoque Hibrido

Status: implementado para controle manual e baixa automatica simples por venda.

O Estoque Inteligente do HubOn controla itens de estoque em dois modos:

- `MANUAL`: o saldo muda somente por movimentacoes manuais.
- `DIRECT_SALE`: o item pode ser vinculado a um produto vendido e baixado
  automaticamente quando o pedido e enviado para a cozinha.

Nao existe ficha tecnica, receita multi-ingrediente, producao, rendimento,
conversao automatica de unidades, compras, fornecedores, lotes, validade ou
multiplos depositos neste escopo.

## Entidades

### `Ingredient`

Representa um item de estoque controlado.

Campos principais:

- `id`
- `name`
- `description`
- `unit`
- `controlMode`
- `currentStock`
- `minimumStock`
- `idealStock`
- `active`
- `createdAt`
- `updatedAt`

Unidades aceitas: `KG`, `G`, `L`, `ML`, `UN`, `CX`, `PACKAGE` e `TRAY`.
Nao ha conversao automatica entre unidades.

Regras:

- nome obrigatorio;
- nome unico ignorando maiusculas e minusculas;
- unidade obrigatoria;
- `controlMode` padrao e `MANUAL`;
- saldos usam `BigDecimal`;
- `currentStock`, `minimumStock` e `idealStock` nao podem ser negativos;
- `idealStock` deve ser maior ou igual a `minimumStock`;
- item novo inicia com `currentStock = 0`;
- o CRUD nao aceita alteracao direta de `currentStock`;
- saldo muda somente por movimentacao;
- exclusao fisica nao faz parte do fluxo, apenas ativacao/desativacao.

Status de estoque:

| Condicao | Status |
| --- | --- |
| `currentStock == 0` | `OUT_OF_STOCK` |
| `currentStock <= minimumStock` | `LOW_STOCK` |
| `currentStock > minimumStock` | `NORMAL` |

### `ProductStockLink`

Representa o vinculo simples entre uma variacao vendida e um item de estoque.

Campos principais:

- `id`
- `productVariant`
- `stockItem`
- `quantityPerSale`
- `active`
- `createdAt`
- `updatedAt`

Regras:

- existe no maximo um vinculo ativo por variacao;
- variacao, produto base e categoria devem estar ativos;
- item de estoque deve estar ativo;
- item vinculado deve ter `controlMode = DIRECT_SALE`;
- `quantityPerSale` deve ser maior que zero;
- remover o vinculo apenas desativa o registro;
- movimentacoes antigas permanecem no historico.

### `InventoryMovement`

Registra toda alteracao do saldo de um item.

Campos principais:

- `id`
- `ingredient`
- `type`
- `quantity`
- `previousStock`
- `resultingStock`
- `reason`
- `originType`
- `originReference`
- `order`
- `orderItem`
- `user`
- `createdAt`

Tipos:

- `ENTRY`: entrada manual, soma ao saldo.
- `EXIT`: saida manual ou baixa automatica, subtrai do saldo.
- `LOSS`: perda, subtrai do saldo e exige motivo.
- `ADJUSTMENT`: ajuste para um novo saldo fisico e exige motivo.
- `REVERSAL`: estorno automatico de uma baixa por pedido.

Origens:

- `MANUAL`: movimentacoes registradas pela tela de estoque.
- `ORDER_ITEM`: baixa automatica criada por um item vendido.
- `ORDER_CANCELLATION`: estorno automatico criado ao cancelar pedido elegivel.

Regras:

- toda alteracao de estoque cria movimentacao;
- quantidade movimentada deve ser positiva;
- nenhum movimento pode deixar saldo negativo;
- saldo anterior e saldo resultante sao gravados;
- usuario e registrado a partir da autenticacao, com fallback para o criador do
  pedido nos fluxos internos;
- item e movimento sao alterados na mesma transacao;
- o item e bloqueado com lock pessimista durante a movimentacao;
- reenvio do mesmo pedido para cozinha nao duplica baixa de itens `KITCHEN`;
- itens `DIRECT_SERVICE` nao dependem do envio para cozinha para baixar estoque;
- cancelamento repetido de pedido ja cancelado nao duplica estorno.

## Baixa automatica por pedido

A baixa automatica depende do fluxo de preparo do produto base:

- `KITCHEN`: ocorre em `POST /api/orders/{id}/send-to-kitchen`, na transicao
  `CREATED -> SENT_TO_KITCHEN`.
- `DIRECT_SERVICE`: ocorre na criacao do pedido. O item nao entra na fila da
  cozinha e fica pronto imediatamente.

Para cada item ativo do pedido:

1. O sistema procura um vinculo ativo da variacao vendida.
2. Se nao existir vinculo, nao ha movimentacao de estoque.
3. Se existir vinculo, o item de estoque e bloqueado.
4. A quantidade baixada e `orderItem.quantity * quantityPerSale`.
5. Se o saldo for insuficiente, a operacao e bloqueada. Para itens `KITCHEN`, o
   pedido permanece em `CREATED`.
6. A movimentacao `EXIT` e gravada com origem `ORDER_ITEM`.

Itens `MANUAL` nunca sao baixados por pedidos.

Mensagem de saldo insuficiente:

```text
Estoque insuficiente para Coca-Cola Lata. Disponivel: 2 UN. Necessario: 3 UN.
```

## Estorno por cancelamento

Quando um pedido que ja gerou baixa automatica e cancelado, o HubOn cria uma
movimentacao `REVERSAL` para cada baixa `ORDER_ITEM` ainda nao estornada.

O estorno:

- soma a quantidade baixada de volta ao item;
- mantem referencia ao pedido e ao item do pedido;
- roda na mesma transacao do cancelamento;
- e idempotente para chamadas repetidas.

Pedidos entregues continuam sem cancelamento. Pedidos em comandas fechadas ou
com pagamentos registrados continuam bloqueados pelas regras financeiras atuais.

## Endpoints

Itens de estoque:

- `GET /api/ingredients`
- `GET /api/ingredients/active`
- `GET /api/ingredients/alerts`
- `GET /api/ingredients/{id}`
- `POST /api/ingredients`
- `PUT /api/ingredients/{id}`
- `PATCH /api/ingredients/{id}/activate`
- `PATCH /api/ingredients/{id}/deactivate`

Movimentacoes:

- `GET /api/inventory-movements`
- `GET /api/inventory-movements/ingredient/{ingredientId}`
- `POST /api/inventory-movements/entries`
- `POST /api/inventory-movements/exits`
- `POST /api/inventory-movements/losses`
- `POST /api/inventory-movements/adjustments`

Vinculo variacao-estoque:

- `GET /api/product-variants/{variantId}/stock-link`
- `POST /api/product-variants/{variantId}/stock-link`
- `PUT /api/product-variants/{variantId}/stock-link`
- `DELETE /api/product-variants/{variantId}/stock-link`

## Permissoes

| Perfil | Permissao |
| --- | --- |
| `OWNER` | Gerencia itens, movimentacoes e vinculos. |
| `ADMIN` | Gerencia itens, movimentacoes e vinculos. |
| `CASHIER` | Consulta itens, alertas, historico e vinculos. |
| `WAITER` | Consulta itens, alertas e historico. |
| `KITCHEN` | Consulta itens, alertas e historico. |

A seguranca real esta no backend. O frontend apenas oculta acoes que o perfil
nao pode executar.

## Interface

A rota `/stock` exibe:

- cards de itens ativos, zerados, baixo estoque, manuais, baixa automatica e
  movimentos recentes;
- tabela de itens com busca por nome;
- filtros por todos, controle manual, baixa automatica, zerados, estoque baixo
  e inativos;
- cadastro e edicao de itens para `OWNER` e `ADMIN`;
- modo de controle com ajuda contextual;
- ativacao e desativacao;
- registro de entrada, saida, perda e ajuste;
- saida manual com saldo atual, quantidade, saldo previsto e sugestoes de
  motivo;
- historico por item;
- menu compacto de acoes por item.

Na tela de Produtos, o produto base guarda nome, descricao, categoria, fluxo de
preparo e status. As variacoes guardam nome, SKU, preco, status e o vinculo de
estoque. A acao de vinculo permite escolher um item ativo em `DIRECT_SALE` e
informar a quantidade por venda da variacao.

## Fora do escopo atual

- ficha tecnica;
- receita multi-ingrediente;
- producao;
- rendimento;
- conversao automatica de unidades;
- compras;
- fornecedores;
- financeiro de compras;
- lotes;
- validade;
- multiplos depositos;
- sugestao automatica de compra;
- capacidade de producao.
