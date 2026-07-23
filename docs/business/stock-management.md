# Estoque Inteligente

Status: primeira etapa implementada.

O Estoque Inteligente separa produto vendido de ingrediente ou insumo
controlado. Um produto e o item do cardapio; um ingrediente e algo consumido,
perdido, ajustado ou reposto manualmente, como carne, pao, queijo, molho,
refrigerante ou embalagem.

Esta etapa entrega a base operacional e auditavel do estoque, sem compras,
fornecedores, financeiro ou baixa automatica por pedido.

## Entidades

### `Ingredient`

Representa um insumo controlado.

Campos principais:

- `id`
- `name`
- `description`
- `unit`
- `currentStock`
- `minimumStock`
- `idealStock`
- `active`
- `createdAt`
- `updatedAt`

Unidades aceitas: `KG`, `G`, `L`, `ML`, `UN`, `CX`, `PACKAGE` e `TRAY`.
Nao ha conversao automatica entre unidades nesta etapa.

Regras:

- nome obrigatorio;
- nome unico ignorando maiusculas e minusculas;
- unidade obrigatoria;
- saldos usam `BigDecimal`;
- `currentStock`, `minimumStock` e `idealStock` nao podem ser negativos;
- `idealStock` deve ser maior ou igual a `minimumStock`;
- ingrediente novo inicia com `currentStock = 0`;
- o CRUD nao aceita alteracao direta de `currentStock`;
- saldo muda somente por movimentacao;
- exclusao fisica nao faz parte do fluxo, apenas ativacao/desativacao.

Status de estoque:

| Condicao | Status |
| --- | --- |
| `currentStock == 0` | `OUT_OF_STOCK` |
| `currentStock <= minimumStock` | `LOW_STOCK` |
| `currentStock > minimumStock` | `NORMAL` |

### `InventoryMovement`

Registra toda alteracao manual do saldo de um ingrediente.

Campos principais:

- `id`
- `ingredient`
- `type`
- `quantity`
- `previousStock`
- `resultingStock`
- `reason`
- `user`
- `createdAt`

Tipos:

- `ENTRY`: entrada, soma ao saldo.
- `EXIT`: saida manual, subtrai do saldo.
- `LOSS`: perda, subtrai do saldo e exige motivo.
- `ADJUSTMENT`: ajuste para um novo saldo fisico e exige motivo.
- `REVERSAL`: reservado para estornos futuros.

Regras:

- toda alteracao de estoque cria movimentacao;
- quantidade movimentada deve ser positiva;
- movimentos manuais nao podem deixar saldo negativo;
- saldo anterior e saldo resultante sao gravados;
- usuario e sempre o usuario autenticado;
- o frontend nao envia nem escolhe usuario;
- ingrediente e movimento sao alterados na mesma transacao;
- o ingrediente e bloqueado com lock pessimista durante a movimentacao;
- movimentacoes nao possuem endpoint de edicao ou exclusao.

### `ProductIngredient`

Representa a ficha tecnica de um produto.

Campos principais:

- `id`
- `product`
- `ingredient`
- `quantity`
- `createdAt`
- `updatedAt`

Regras:

- produto e ingrediente devem estar ativos para alterar a ficha;
- a quantidade deve ser maior que zero;
- o mesmo ingrediente nao pode aparecer duas vezes no mesmo produto;
- a unidade consumida e a unidade cadastrada no ingrediente;
- nao ha conversao automatica nesta etapa;
- a substituicao completa da ficha valida toda a lista antes de alterar e roda
  em uma unica transacao.

## Endpoints

Ingredientes:

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

Ficha tecnica:

- `GET /api/products/{productId}/ingredients`
- `POST /api/products/{productId}/ingredients`
- `PUT /api/products/{productId}/ingredients/{ingredientId}`
- `DELETE /api/products/{productId}/ingredients/{ingredientId}`
- `PUT /api/products/{productId}/ingredients`

## Permissoes

| Perfil | Permissao |
| --- | --- |
| `OWNER` | Gerencia ingredientes, movimentacoes e ficha tecnica. |
| `ADMIN` | Gerencia ingredientes, movimentacoes e ficha tecnica. |
| `CASHIER` | Consulta ingredientes, alertas, historico e ficha tecnica. |
| `WAITER` | Consulta ingredientes, alertas, historico e ficha tecnica. |
| `KITCHEN` | Consulta ingredientes, alertas, historico e ficha tecnica. |

A seguranca real esta no backend. O frontend apenas oculta acoes que o perfil
nao pode executar.

## Interface

A rota `/stock` exibe:

- cards de ingredientes ativos, zerados, baixo estoque e movimentos recentes;
- tabela de ingredientes com busca por nome;
- filtro por status;
- cadastro e edicao de ingredientes para `OWNER` e `ADMIN`;
- ativacao e desativacao;
- registro de entrada, saida, perda e ajuste;
- historico por ingrediente.

Na tela de Produtos, a acao "Ficha tecnica" abre a receita do produto e permite
adicionar, editar quantidade, remover ingredientes e salvar a ficha completa.

## Ainda nao implementado

- compras;
- fornecedores;
- contas a pagar;
- financeiro;
- lotes;
- validade;
- multiplos depositos;
- conversao automatica de unidades;
- baixa automatica ligada ao pedido;
- estorno automatico;
- sugestao automatica de compra;
- capacidade de producao.

## Proxima etapa

A proxima etapa e conectar a ficha tecnica ao ciclo do pedido para criar baixa
automatica quando o pedido entrar no evento operacional escolhido, preservando
idempotencia, historico auditavel e regras futuras de estorno.
