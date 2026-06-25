# Estoque Inteligente

> **Status:** funcionalidade planejada para o pós-MVP. Este documento registra
> decisões de produto e uma proposta inicial; não descreve código, endpoints,
> tabelas ou telas já implementados.

## Visão geral

O HubOn deve diferenciar o **produto vendido** do **ingrediente ou insumo de
estoque**. Um produto é aquilo que o cliente compra, como a Jantinha
Tradicional. Os itens de estoque são os recursos consumidos para produzi-lo e
entregá-lo, como arroz, feijão, carne, farofa, vinagrete, embalagem e talher
descartável.

Essa separação permitirá:

- reduzir a contagem manual;
- antecipar a falta de ingredientes;
- controlar perdas e desperdícios;
- estimar a capacidade de produção;
- apoiar a lista de compras;
- melhorar o controle de custos e o planejamento financeiro.

O foco inicial são trailers, lanchonetes e pequenos restaurantes que vendem
jantinhas, marmitas, espetinhos, bebidas e acompanhamentos. As decisões devem
priorizar a operação real, inclusive quando o estoque cadastrado estiver
temporariamente diferente do estoque físico.

## Conceitos principais

### Item de estoque ou insumo

Representa algo cuja quantidade precisa ser acompanhada. Exemplos: arroz,
feijão, carne, frango, linguiça, farofa, vinagrete, refrigerante, embalagem,
talher e carvão. Gás poderá ser incluído futuramente caso a operação decida
controlá-lo como insumo consumível.

Campos planejados para o domínio futuro, com nomes de código em inglês:

- `id`;
- `name`;
- `unit`;
- `currentQuantity`;
- `minimumQuantity`;
- `costPerUnit`;
- `active`;
- `createdAt`;
- `updatedAt`.

Unidades planejadas para exibição: `g`, `kg`, `ml`, `l`, `unidade`, `pacote` e
`caixa`. Internamente, massa usará gramas, volume usará mililitros e itens
indivisíveis usarão unidades, conforme as decisões da primeira implementação.
A receita e o saldo deverão ser convertidos para uma unidade base comparável.

### Receita ou ficha técnica

Liga um produto vendável aos insumos necessários para produzir e entregar uma
unidade. A Jantinha Tradicional, por exemplo, poderá consumir:

- 250 g de arroz;
- 150 g de feijão;
- 120 g de carne;
- 40 g de farofa;
- 50 g de vinagrete;
- 1 embalagem;
- 1 talher.

Cada linha planejada da receita terá:

- `id`;
- `productId`;
- `inventoryItemId`;
- `quantity`;
- `active`.

A ficha técnica também permitirá estimar o custo do produto com base no último
custo unitário informado para cada insumo. A forma de preservar o custo
histórico detalhado da venda ainda precisa ser definida.

### Movimentação de estoque

Toda alteração de quantidade deverá gerar histórico. Alterar apenas o saldo
atual, sem registrar sua origem, não será permitido pelo fluxo normal.

Tipos planejados:

- `PURCHASE`: entrada por compra;
- `SALE`: consumo associado a uma venda;
- `ADJUSTMENT`: correção de inventário;
- `LOSS`: perda ou desperdício;
- `RETURN`: devolução ao estoque.

Campos planejados:

- `id`;
- `inventoryItemId`;
- `type`;
- `quantity`;
- `unitCost`;
- `reason`;
- `createdByUserId`;
- `relatedOrderId`;
- `createdAt`.

A convenção de sinal da quantidade e a eventual necessidade de saldo anterior
e posterior na movimentação serão fechadas antes do modelo físico.

### Fornecedor

Fornecedores formam uma etapa complementar, prevista para a fase de compras.
Campos planejados:

- `id`;
- `name`;
- `phone`;
- `notes`;
- `active`.

## Fluxo de baixa automática

Fluxo planejado:

1. O cliente escolhe um produto e o pedido é criado, ainda sem movimentar o
   estoque.
2. Quando o pedido é enviado para a cozinha ou entra no fluxo de preparo, o
   sistema consulta a receita ativa do produto.
3. Para cada ingrediente, multiplica a quantidade da receita pela quantidade
   vendida, baixa o saldo e cria uma movimentação `SALE`.
4. As movimentações ficam associadas ao pedido que as originou.

Exemplo para a venda de duas Jantinhas Tradicionais:

| Insumo | Receita unitária | Baixa total |
| --- | ---: | ---: |
| Arroz | 250 g | 500 g |
| Feijão | 150 g | 300 g |
| Carne | 120 g | 240 g |
| Embalagem | 1 unidade | 2 unidades |

A baixa deverá ocorrer na mesma transação da transição que envia o pedido para
a cozinha ou inicia seu preparo, para não existir pedido parcialmente baixado.
Criar o pedido, por si só, não deverá consumir estoque.

## Estoque insuficiente

A decisão inicial é **não bloquear a venda**. Em trailers e operações rápidas,
o saldo cadastrado pode estar atrasado em relação ao estoque físico, e impedir
o atendimento pode causar mais prejuízo do que permitir uma correção posterior.

Regras planejadas:

- com saldo suficiente, a baixa ocorre normalmente;
- com saldo insuficiente, a baixa também ocorre e pode tornar o saldo negativo;
- a operação gera um alerta claro sobre os itens insuficientes;
- saldos negativos permanecem visíveis até o ajuste;
- uma configuração futura poderá habilitar “bloquear venda sem estoque”.

Permitir saldo negativo não elimina o histórico nem transforma o problema em
silêncio: ele sinaliza uma divergência operacional que precisa ser apurada.

## Estoque baixo e esgotado

O status planejado será calculado a partir do saldo:

| Condição | Status |
| --- | --- |
| `currentQuantity <= 0` | Esgotado |
| `currentQuantity > 0` e `currentQuantity <= minimumQuantity` | Baixo estoque |
| `currentQuantity > minimumQuantity` | Normal |

Os alertas deverão aparecer no Dashboard e na tela de Estoque. Também poderá
haver aviso na tela de Pedido ao selecionar um produto, sem bloquear a venda na
configuração inicial.

## Capacidade de produção

Com o estoque atual e a receita, o sistema poderá calcular quantas unidades
inteiras de um produto ainda podem ser preparadas. Para cada insumo, calcula-se
`floor(saldo disponível / consumo por unidade)`; o menor resultado é a
capacidade do produto, e o insumo correspondente é o limitante.

Exemplo:

| Insumo | Receita | Estoque | Capacidade pelo insumo |
| --- | ---: | ---: | ---: |
| Arroz | 250 g | 10 kg | 40 jantinhas |
| Feijão | 150 g | 8 kg | 53 jantinhas |
| Carne | 120 g | 3 kg | 25 jantinhas |

Resultado aproximado: **25 jantinhas**, limitado pela carne. Essa visão é um
diferencial importante para o dono decidir o que pode continuar oferecendo e o
que precisa comprar antes do próximo turno.

Receitas ausentes, incompletas, insumos inativos e saldos negativos exigirão
tratamento explícito para que a estimativa não pareça mais confiável do que é.

## Lista de reposição e compras

Em uma etapa futura, o HubOn deverá:

- identificar itens abaixo do mínimo;
- sugerir uma quantidade de compra;
- registrar a entrada por compra;
- associar a compra a um fornecedor;
- apoiar o planejamento do dia seguinte.

Exemplo de sugestão: comprar 5 kg de arroz, 3 kg de carne e 100 embalagens. A
fórmula de sugestão ainda deverá considerar se o mínimo é apenas um limite de
alerta ou também o nível desejado após a reposição.

## Telas planejadas

### Estoque

Deverá listar item, quantidade atual, unidade, mínimo, status e custo. Ações
planejadas: entrada, ajuste, perda e consulta do histórico.

### Receitas ou fichas técnicas

Poderá ser integrada à tela de Produto. Permitirá adicionar ingrediente, editar
quantidade, remover ingrediente e consultar o custo estimado do produto.

### Movimentações

Permitirá consultar histórico por item, período e tipo, incluindo usuário
responsável e pedido relacionado quando houver.

### Alertas

O Dashboard deverá destacar itens críticos, baixo estoque e produtos com baixa
capacidade de produção.

## Modelo de dados planejado

Nomes preliminares de tabelas:

- `inventory_items`;
- `product_recipes`;
- `inventory_movements`;
- `suppliers`;
- `purchase_entries` ou `stock_entries`, a decidir.

Relacionamentos planejados:

```text
products 1 ── N product_recipes N ── 1 inventory_items
inventory_items 1 ── N inventory_movements
users 1 ── N inventory_movements
orders 1 ── N inventory_movements       quando a origem for venda
suppliers 1 ── N purchase_entries       fase futura
```

Esse modelo é conceitual. Não há migration criada nem compromisso definitivo
com nomes, tipos ou restrições até a revisão técnica.

## Regras de negócio planejadas

- Item com movimentações não será excluído fisicamente; poderá ser inativado.
- Produto poderá existir sem receita, mas não terá baixa automática.
- Produto com receita ausente ou incompleta deverá gerar alerta.
- Venda de produto sem receita não movimentará estoque.
- Venda de produto com receita baixará seus ingredientes.
- Pagamento não afetará estoque; a movimentação estará ligada ao pedido/venda.
- Ajuste manual e perda exigirão motivo.
- Entrada registrará o usuário responsável.
- Pedido criado e ainda não enviado à cozinha não exigirá estorno, pois ainda
  não terá baixado estoque.
- Cancelamento após a baixa e antes da entrega poderá estornar automaticamente,
  desde que a baixa exista e o processo seja idempotente.
- Pedido entregue não terá estorno automático; uma correção exigirá movimento
  manual e justificativa.

Para evitar estorno duplicado, a implementação deverá tornar baixa e estorno
idempotentes e preservar o vínculo entre movimentos relacionados.

## Decisões fechadas para a primeira implementação

> As decisões desta seção orientam a implementação futura das versões v0.4.0 e
> v0.4.1. O módulo de Estoque Inteligente ainda não foi implementado.

### 1. Unidade base e conversões

- Massa será armazenada internamente em gramas.
- Volume será armazenado internamente em mililitros.
- Itens indivisíveis serão armazenados em unidades.
- A interface poderá exibir `kg`, `g`, `l`, `ml`, `unidade`, `pacote` e `caixa`,
  mas o cálculo interno usará uma unidade base comparável.
- Pacote e caixa serão formas de apresentação ou entrada. Seu conteúdo deverá
  ser convertido para gramas, mililitros ou unidades conforme o tipo do item.

Exemplos:

- 10 kg de arroz = 10.000 g;
- 2 litros de óleo = 2.000 ml;
- 100 embalagens = 100 unidades.

### 2. Momento da baixa automática

- A baixa ocorrerá quando o pedido for enviado para a cozinha ou entrar no
  fluxo de preparo.
- A simples criação do pedido ainda não baixará estoque, pois ele poderá ser
  corrigido ou cancelado antes do preparo.
- A baixa e a transição de status escolhida deverão ocorrer na mesma transação.

### 3. Cancelamento e estorno

- Pedido criado e ainda não enviado para a cozinha não terá baixa nem estorno.
- Pedido já enviado para a cozinha, mas ainda não entregue, poderá estornar
  automaticamente, desde que a baixa exista.
- Baixa e estorno deverão ser idempotentes para impedir movimentações
  duplicadas em repetição de requisição ou processamento.
- Pedido entregue não estornará automaticamente.
- Correções após a entrega serão feitas por movimento manual com justificativa.

### 4. Estoque insuficiente

- A primeira versão não bloqueará a venda.
- O sistema permitirá saldo negativo e exibirá alerta claro.
- Bloquear venda sem estoque poderá se tornar uma configuração futura.

### 5. Custo

- A primeira versão usará o último custo informado no item de estoque.
- Uma entrada de estoque poderá atualizar o custo unitário atual.
- Custo médio ponderado ficará para evolução futura.
- O custo histórico detalhado da venda será discutido em uma etapa posterior.

### 6. Produto sem receita

- Produto sem receita poderá ser vendido normalmente.
- A venda desse produto não fará baixa automática.
- Receita ausente será sinalizada como alerta administrativo.
- Produto com receita ativa fará a baixa automática dos insumos quando entrar
  no fluxo de cozinha ou preparo.

### 7. Permissões planejadas

| Perfil | Permissões planejadas |
| --- | --- |
| `OWNER` | Gerenciar estoque, entradas, ajustes, perdas e custos. |
| `ADMIN` | Gerenciar estoque, entradas, ajustes, perdas e custos. |
| `CASHIER` | Consultar estoque e alertas, sem ajustar saldo. |
| `WAITER` | Ver alertas operacionais durante a venda, sem ajustar saldo. |
| `KITCHEN` | Consultar disponibilidade e alertas, sem ajustar saldo. |

Essas permissões ainda deverão ser aplicadas tanto na API quanto na interface
quando o módulo for implementado.

### 8. Itens descartáveis

- Embalagem, talher, guardanapo e itens semelhantes serão tratados como itens de
  estoque normais.
- O controle é relevante para trailers e vendas de jantinhas porque os
  descartáveis afetam tanto o custo quanto a disponibilidade do produto final.

## Roadmap

### v0.4.0 — Estoque base

- cadastro de itens;
- entrada, ajuste e perda manuais;
- estoque mínimo e alertas;
- histórico de movimentações.

### v0.4.1 — Receitas e baixa automática

- ficha técnica por produto;
- baixa automática por venda;
- movimentos `SALE` associados ao pedido;
- alertas de receita ausente ou incompleta.

### v0.4.2 — Capacidade de produção

- cálculo de capacidade por produto;
- identificação do ingrediente limitante;
- alertas de produção baixa.

### v0.4.3 — Compras e fornecedores

- fornecedores;
- lista de reposição;
- entrada por compra;
- histórico de compras.

As versões expressam uma sequência desejada, não funcionalidades entregues nem
datas prometidas.

## Pontos em aberto antes da implementação

- Como tratar adicionais, remoções e substituições no pedido?
- Como controlar alterações de receita sem reescrever o histórico?
- Como a previsão de compras considerará estoque-alvo, consumo esperado e
  histórico de vendas?
- `purchase_entries` e seus itens serão necessários ou uma movimentação
  `PURCHASE` será suficiente na primeira versão?
- Quando e como adotar custo médio ponderado em uma evolução futura?
- Lote e validade deverão ser controlados em uma versão futura?
