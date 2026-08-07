# Dominio simplificado do HubOn

## Status da proposta

- Data: 2026-08-07.
- Branch de trabalho: `feat/simplificacao-dominio`.
- Escopo: modelagem anterior a qualquer alteracao funcional.
- O SQL associado e apenas uma proposta e nao deve ser executado nesta etapa.
- Entidades Java, frontend, endpoints, roles e migrations atuais permanecem
  inalterados ate autorizacao explicita.

## Objetivo

O HubOn deve registrar, com poucos passos e rastreabilidade:

> o que foi consumido, quanto custou, quanto foi pago e o que saiu do estoque.

O sistema nao representa mais producao ou cozinha. O agregado operacional e
`Sale`, usado tanto para mesa quanto para balcao. Um item adicionado ja e um
lancamento efetivo; nao existem rascunho, confirmacao, envio, preparo, pronto ou
entrega.

## Diagnostico do modelo atual

### Estrutura existente

O fluxo persistido hoje e:

```text
RestaurantTable -> Tab -> RestaurantOrder -> OrderItem -> OrderItemOption
                         |                    |
                         |                    -> InventoryMovement
                         -> Payment -> CashShift

Category -> Product -> ProductVariant -> ProductStockLink -> Ingredient
                    -> ProductOptionGroup -> ProductOption
```

- `Tab` ja concentra origem (`TABLE` ou `COUNTER`), valores e pagamentos.
- `RestaurantOrder` adiciona uma camada entre comanda e consumo.
- `OrderItem` possui seis estados, snapshots de variacao e de preparo.
- `ProductVariant` e a unidade vendavel e a unica fonte de preco.
- `PreparationFlow` separa preparo e entrega direta.
- `RestaurantTable.status` armazena `OCCUPIED`, embora a existencia de uma
  comanda aberta tambem represente ocupacao.
- A baixa automatica acontece na confirmacao do pedido, e o estorno referencia
  pedido e item de pedido.
- Pagamentos bloqueiam a comanda, exigem caixa aberto e podem iniciar preparo.
- Relatorios consultam diretamente `tabs`, `orders`, `order_items` e seus
  estados.

### Problemas identificados

1. `Tab`, `RestaurantOrder` e dois conjuntos de status representam um unico
   fato comercial com fontes de verdade concorrentes.
2. Todo produto precisa de uma variacao, inclusive a variacao artificial
   `Padrao`, para possuir preco e ser vendido.
3. O momento real de consumo fica atras de uma confirmacao de pedido que nao faz
   parte da operacao desejada.
4. `RestaurantTable.status = OCCUPIED` duplica a informacao de uma venda de mesa
   aberta e exige sincronizacao manual.
5. O estoque generico e chamado `Ingredient` e ainda possui conceitos de
   `controlMode` e estoque ideal que nao sao necessarios no alvo.
6. Pagamento, caixa, dashboard e relatorios dependem de estados de preparo para
   decidir a proxima acao ou considerar um item valido.
7. As migrations `V1` a `V9` contam a evolucao do modelo antigo. Como nao ha
   dados reais, carregar essa historia para o novo dominio criaria complexidade
   sem beneficio.

## Contextos e responsabilidades

### Venda

`Sale` e a raiz transacional. Ela controla origem, itens, taxas, descontos,
pagamentos e encerramento. Os totais sao calculados a partir dos lancamentos.
Toda alteracao financeira ou de estoque comeca bloqueando a venda aberta
correspondente.

### Catalogo

`Category` apenas organiza. `Product` e diretamente vendavel e possui o preco.
Grupos e opcoes continuam modelando escolhas reais, sem se confundirem com
variacoes de produto.

### Estoque

`StockItem` representa qualquer item controlado. `StockMovement` e o livro
imutavel de alteracoes. `current_stock` e um saldo operacional mantido na mesma
transacao do movimento, e nao substitui o historico.

### Caixa

`CashShift` e `CashMovement` continuam controlando turno, suprimentos e
sangrias. `Payment` permanece o unico registro de recebimento e apenas aponta
para o turno; o modulo Caixa nao duplica pagamentos.

### Relatorios

Receita e volume sao calculados a partir de vendas fechadas, itens nao
cancelados e pagamentos. Movimentos de estoque sustentam a auditoria de saidas
e estornos. Nenhuma consulta depende de estado de preparo.

## Modelo alvo

```text
RestaurantTable 1 -------- 0..N Sale
                              | 1
                              |
                              +------ 0..N SaleItem 1 ------ 0..N SaleItemOption
                              |
                              +------ 0..N Payment N ------- 0..1 CashShift

Category 0..1 ------ 0..N Product 1 -------- 0..N ProductOptionGroup
                            |                         |
                            |                         +------ 0..N ProductOption
                            |
                            +------ 0..N ProductStockLink N ------ 1 StockItem

SaleItem 1 -------- 0..N StockMovement N -------- 1 StockItem
```

### `Sale`

Representa uma venda de mesa ou de balcao.

Campos:

- `id`;
- `type`: `TABLE` ou `COUNTER`;
- `restaurant_table_id`, obrigatorio para mesa e nulo para balcao;
- `table_number_snapshot`, obrigatorio para mesa e nulo para balcao;
- `customer_name` e `customer_phone`, opcionais;
- `status`: somente `OPEN`, `CLOSED` ou `CANCELLED`;
- `service_fee` e `discount_amount`;
- autoria e instante de abertura;
- autoria, instante e data comercial de fechamento;
- autoria, instante e motivo de cancelamento;
- `created_at` e `updated_at`.

`subtotal_amount`, `paid_amount`, `remaining_amount` e `final_amount` nao sao
colunas de `Sale`. Todos sao derivados de `SaleItem`, `Payment`, `service_fee`
e `discount_amount` no momento da consulta ou validacao transacional.
`table_number_snapshot` preserva a identificacao historica mesmo que a mesa seja
renumerada posteriormente.

### `RestaurantTable`

Mantem apenas `id`, `number`, `label`, `active` e timestamps. Nao possui status
de ocupacao nem reserva.

Estados exibidos sao derivados:

- ocupada: existe `Sale` do tipo `TABLE`, com `status = OPEN`, para a mesa;
- livre: mesa ativa sem venda aberta;
- desativada: `active = false`.

O modelo alvo nao inclui reserva, pois ela nao participa do fluxo solicitado.

### `Category`

Mantem `id`, `name`, `display_order`, `active` e timestamps. Categoria serve
somente para organizar o catalogo: pode estar ausente e seu estado nao participa
da validacao de venda. Desativar uma categoria nao desativa seus produtos nem
altera vendas antigas.

### `Product`

E a unidade vendavel. Possui `category_id` opcional, nome, descricao opcional,
`price`, `active`, `available`, ordem e timestamps. Um produto sem categoria
continua vendavel.

Nao existem `ProductVariant`, SKU, `PreparationFlow` nem imagem de produto.
Apresentacoes comerciais diferentes sao produtos diferentes.

### `ProductOptionGroup` e `ProductOption`

O grupo pertence ao produto e define `minimum_selections` e
`maximum_selections`. `minimum_selections > 0` e a unica representacao de
obrigatoriedade; o booleano `required` e removido.

Uma opcao pertence a um grupo e possui preco adicional. Grupos e opcoes
inativos permanecem no historico, mas nao podem ser escolhidos em novos itens.

### `SaleItem`

E um lancamento efetivo diretamente dentro de `Sale`. Nao possui estado de
preparo. Um item esta ativo quando `cancelled_at IS NULL` e cancelado quando o
instante, o responsavel e o motivo de cancelamento estao preenchidos.

Snapshots obrigatorios:

- nome do produto;
- nome da categoria, usando `Sem categoria` quando `Product.category_id` for
  nulo;
- preco base unitario;
- preco unitario final, incluindo opcoes;
- subtotal (`unit_price_snapshot * quantity`).

O registro nao e apagado fisicamente depois de criado.
Quantidade, produto e opcoes tambem nao sao editados silenciosamente: uma
correcao cancela o item original e cria um novo lancamento.

### `SaleItemOption`

Preserva grupo, nome e preco adicional escolhidos. `product_option_id` pode ser
nulo para permitir desvinculacao futura sem perder o historico; os snapshots
continuam obrigatorios.

### `Payment`

Pertence a uma venda, aceita os metodos atuais e permite multiplos registros.
O valor e sempre positivo. Novos pagamentos operacionais continuam associados
ao turno de caixa aberto; a coluna e nula no schema para manter o relacionamento
conceitualmente opcional e acomodar eventual importacao autorizada.

Pagamentos sao lancamentos imutaveis no MVP. Estorno ou devolucao financeira
nao esta modelado e nao deve ser simulado apagando ou alterando um pagamento.
Depois do primeiro pagamento, itens existentes nao podem ser alterados nem
cancelados. A propria venda tambem nao pode ser cancelada enquanto nao existir
um fluxo explicito de estorno financeiro.

### `StockItem`

Substitui `Ingredient` e representa bebida, ingrediente, embalagem ou outro
insumo. Mantem unidade, saldo atual, estoque minimo, estado e timestamps.

`ideal_stock` e `control_mode` saem do modelo. A existencia de um
`ProductStockLink` ativo e que determina a baixa automatica; itens sem vinculo
sao movimentados manualmente.

### `ProductStockLink`

Liga diretamente `Product` a `StockItem` e define a quantidade consumida por
unidade vendida. Para o MVP existe no maximo um vinculo automatico ativo por
produto. Vinculos antigos podem permanecer inativos para auditoria cadastral.

Essa decisao impede que o vinculo seja usado como ficha tecnica
multi-ingrediente. Receitas e producao permanecem fora do escopo.

### `StockMovement`

E append-only e registra `delta_quantity`, saldo anterior, saldo resultante,
tipo, autoria e origem opcional em `SaleItem`.

Tipos:

- `ENTRY`: delta positivo;
- `SALE`: delta negativo;
- `SALE_REVERSAL`: delta positivo e referencia o movimento `SALE` original;
- `EXIT`: delta negativo;
- `LOSS`: delta negativo;
- `ADJUSTMENT`: delta positivo ou negativo.

`reversed_movement_id` torna o estorno explicitamente rastreavel. Uma restricao
unica permite no maximo um `SALE_REVERSAL` para cada movimento original.

### `CashShift` e `CashMovement`

Permanecem conceitualmente como hoje:

- um unico turno aberto;
- saldo inicial, operador e conferencia de fechamento;
- `SUPPLY` e `WITHDRAWAL` como movimentos manuais;
- pagamentos consultados pela FK `cash_shift_id`;
- cancelamentos exibidos a partir de `SaleItem`, sem criar recebimento duplicado.

## Invariantes

### Venda e mesa

1. Uma venda `TABLE` tem mesa e snapshot de numero; uma venda `COUNTER` nao tem
   nenhum dos dois.
2. Existe no maximo uma venda aberta por mesa. O servico valida a regra e um
   indice parcial unico no PostgreSQL a garante contra corrida.
3. Uma mesa inativa nao recebe nova venda.
4. Numero ou desativacao de mesa com venda aberta devem ser bloqueados pelo
   dominio; vendas fechadas preservam o snapshot.
5. Venda fechada ou cancelada e imutavel, exceto por correcoes administrativas
   futuras que precisariam de um fluxo auditado proprio.
6. Venda fechada precisa ter ao menos um item nao cancelado e pagamento total
   exatamente igual ao valor final.
7. Venda cancelada nao pode possuir pagamentos no MVP.
8. Taxa e desconto so mudam enquanto a venda estiver aberta e antes do primeiro
   pagamento, sempre sob lock da venda.
9. Depois do primeiro pagamento, nenhum item existente pode ser alterado ou
   cancelado e a venda nao pode ser cancelada.

### Valores

```text
sale_item.unit_price_snapshot =
    sale_item.base_unit_price_snapshot
    + SUM(sale_item_option.additional_price_snapshot)

sale_item.subtotal = sale_item.unit_price_snapshot * sale_item.quantity

subtotal_amount (derivado) = SUM(subtotal dos itens nao cancelados)

final_amount (derivado) =
    MAX(subtotal_amount + sale.service_fee - sale.discount_amount, 0)

paid_amount (derivado) = SUM(payment.amount)
remaining_amount (derivado) = MAX(final_amount - paid_amount, 0)
```

- Dinheiro usa `NUMERIC(12,2)` no banco e `BigDecimal` no Java.
- Quantidades de estoque usam `NUMERIC(15,3)` e `BigDecimal`.
- Precos, subtotais, taxas, descontos e valores finais nao podem ser negativos.
- Quantidade de item e inteira e maior que zero.
- Opcoes adicionais nao podem ter preco negativo no MVP.
- A soma de pagamentos nunca pode ultrapassar `final_amount`.

### Catalogo e opcoes

1. Produto precisa estar ativo e disponivel no momento do lancamento. Categoria
   e opcional e nao participa da vendabilidade. Grupos e opcoes selecionados
   precisam estar ativos.
2. Uma opcao selecionada precisa pertencer ao produto por meio de seu grupo.
3. A mesma opcao nao pode ser repetida no item.
4. Cada grupo ativo respeita minimo e maximo; minimo maior que zero significa
   obrigatorio.
5. Alteracoes cadastrais nao reescrevem snapshots historicos.
6. Cadastros referenciados por operacao sao desativados, nao excluidos.

### Estoque

1. `current_stock` nunca fica negativo.
2. Alterar saldo sem criar `StockMovement` e proibido.
3. `resulting_balance = previous_balance + delta_quantity`.
4. Adicionar item com vinculo ativo cria `SaleItem`, baixa `SALE` e atualiza o
   saldo na mesma transacao.
5. Um `SaleItem` gera no maximo uma baixa automatica no escopo de vinculo unico.
6. Cancelar item gera no maximo um `SALE_REVERSAL` do movimento original.
7. O movimento original nunca e apagado ou alterado.
8. Unidade de um item com movimentos nao pode ser alterada.

## Fluxos operacionais

### Mesa

1. Bloquear a linha da mesa.
2. Validar mesa ativa e ausencia de venda aberta.
3. Criar `Sale(TABLE, OPEN)` com snapshot do numero.
4. Adicionar itens diretamente; cada inclusao passa a compor os totais derivados
   e, quando houver vinculo, baixa o estoque na mesma transacao.
5. Permitir novas inclusoes enquanto a venda estiver aberta.
6. Registrar um ou mais pagamentos vinculados ao caixa aberto.
7. Fechar somente com itens ativos e pagamento exato.

### Balcao

1. Criar `Sale(COUNTER, OPEN)` com identificacao opcional do cliente.
2. Adicionar itens diretamente.
3. Registrar um ou mais pagamentos.
4. Ao atingir pagamento integral, fechar a venda na mesma transacao do ultimo
   pagamento.

Venda de balcao com valor final zero nao fecha automaticamente. Ela pode ser
fechada explicitamente se possuir ao menos um item ativo. Venda vazia nunca
pode ser fechada.

### Inclusao de item e baixa

1. Bloquear a venda e confirmar `OPEN`.
2. Carregar produto e opcoes e validar o catalogo.
3. Calcular todos os snapshots.
4. Localizar o vinculo automatico ativo.
5. Se houver vinculo, bloquear `StockItem`, validar saldo e calcular a baixa.
6. Persistir `SaleItem` e opcoes.
7. Persistir `StockMovement(SALE)` e atualizar `current_stock`.
8. Confirmar tudo junto; qualquer falha causa rollback integral.

Nenhum total derivado e persistido em `Sale` durante essa operacao.

Em inclusao em lote, todos os itens de estoque sao bloqueados por `id`
crescente antes das alteracoes para reduzir risco de deadlock.

### Pagamento

1. Bloquear a venda.
2. Validar `OPEN` e calcular os totais a partir dos itens ativos.
3. Somar pagamentos ja persistidos.
4. Validar valor positivo e menor ou igual ao restante.
5. Bloquear e validar o turno de caixa aberto.
6. Inserir `Payment`.
7. Se for balcao e o total pago ficar exato, fechar a venda no mesmo commit.

Nao se persiste subtotal, valor final, saldo pago ou restante em `Sale`.

### Cancelamento de item

1. Bloquear venda, item e itens de estoque na ordem definida.
2. Se o item ja estiver cancelado, tratar a operacao como idempotente.
3. Rejeitar se a venda nao estiver aberta.
4. Rejeitar a operacao se existir qualquer pagamento para a venda.
5. Preencher autoria, instante e motivo do cancelamento.
6. Criar `SALE_REVERSAL`, quando aplicavel, e atualizar o saldo.

### Cancelamento de venda

Uma venda aberta so pode ser cancelada sem pagamentos. A transacao cancela cada
item ativo, cria os estornos de estoque necessarios e marca a venda como
`CANCELLED`. Vendas com pagamento exigem um futuro fluxo explicito de
devolucao; nao se apaga pagamento para viabilizar cancelamento.

### Fechamento

- venda vazia nunca fecha;
- mesa fecha somente por comando explicito e com pagamento exato;
- mesa com valor final derivado igual a zero pode fechar explicitamente quando
  possuir ao menos um item ativo;
- balcao com valor positivo fecha automaticamente no pagamento integral;
- balcao com valor zero exige fechamento explicito e ao menos um item ativo.

## Concorrencia

O monolito Spring Boot continua usando transacoes locais e locking pessimista.
A ordem global de locks e:

```text
Sale -> SaleItem(s) -> StockItem(s) em id crescente -> CashShift
```

Casos protegidos:

| Corrida | Protecao |
| --- | --- |
| Dois pagamentos | Ambos bloqueiam `Sale`; o segundo recalcula a soma depois do commit do primeiro. |
| Ultima unidade em estoque | Ambos bloqueiam `StockItem`; somente o primeiro que mantiver saldo nao negativo conclui. |
| Duas aberturas da mesma mesa | Lock em `RestaurantTable`, validacao de dominio e indice parcial unico em venda aberta. |
| Dois cancelamentos do mesmo item | Lock em `Sale`/`SaleItem` e unicidade do movimento de reversao. |
| Fechamento contra inclusao ou pagamento | Todas as operacoes bloqueiam primeiro a mesma `Sale`. |
| Dois turnos de caixa | Validacao de dominio e indice parcial unico de turno aberto. |

Falha de lock por timeout deve continuar sendo traduzida para uma mensagem de
conflito/repeticao segura. Nenhuma verificacao do tipo `exists` substitui a
constraint quando a corrida pode violar integridade.

## Integridade e ciclo de vida

### Restricoes no banco

- PKs `BIGINT` identity.
- FKs obrigatorias para autoria e agregados.
- `CHECK` para enums, valores persistidos, subtotal do item, origem da venda,
  auditoria por status e direcao de estoque.
- indices unicos case-insensitive para nomes de catalogo.
- indices parciais para venda aberta por mesa, turno aberto, vinculo ativo por
  produto e baixa por item.
- indices de periodo para relatorios, pagamentos, cancelamentos e movimentos.

### Regras que permanecem no dominio

Restricoes que dependem de soma ou de varias tabelas nao devem ser simuladas por
`CHECK`: selecao minima/maxima, totais derivados da venda, soma de pagamentos,
existencia de pagamento antes de alterar/cancelar item, coerencia entre movimento
de estorno e movimento original e bloqueio de edicao de mesa em uso. Elas ficam
em services transacionais e recebem testes de integracao.

### DELETE e UPDATE

- Venda, item, pagamento e movimento de estoque nao aceitam exclusao fisica.
- Produtos, categorias, opcoes, mesas, usuarios, itens e vinculos de estoque
  usam desativacao.
- FKs operacionais usam `ON DELETE RESTRICT`; `Product.category_id` usa
  `ON DELETE SET NULL` porque categoria e apenas organizacional.
- Apenas `SaleItemOption.product_option_id` usa `ON DELETE SET NULL`, porque o
  snapshot e suficiente para leitura historica.
- Movimentos e pagamentos sao append-only.
- Vendas fechadas/canceladas e seus itens ficam imutaveis.
- Preco, nome e categoria podem mudar apenas no catalogo; historico nao muda.

## Relatorios no modelo alvo

- receita: `sales.status = 'CLOSED'` por `closed_business_date`;
- produtos/categorias: `sale_items.cancelled_at IS NULL` ligados a vendas
  fechadas;
- recebimentos: soma de `payments` da venda fechada;
- canais: `sales.type`;
- cancelamentos: `sale_items.cancelled_at` e `sales.cancelled_at`;
- estoque: `stock_movements.type`, `stock_item_id` e `created_at`.

O conceito de quantidade de pedidos desaparece. Dashboard, PDF, XLSX e CSV
devem trocar indicadores de pedido/preparo por vendas abertas, itens vendidos,
pagamentos pendentes e alertas de estoque.

## Baseline Flyway proposta

Como nao ha dados reais, a implementacao autorizada pode substituir a historia
de desenvolvimento por uma baseline limpa, depois de recriar apenas os bancos
locais e de teste:

```text
db/migration/
  V1__initial_schema.sql       # somente estrutura, constraints e indices
  V2__seed_roles.sql           # somente dados estruturais de autorizacao
```

Dados de demonstracao nao devem entrar na localizacao Flyway comum. O
`DataSeeder`, habilitado apenas por `hubon.seed.enabled=true`, e uma separacao
melhor porque usuarios exigem senha configuravel e BCrypt. Ele deve ser adaptado
ao novo catalogo, mas continuar desabilitado em producao.

A troca da baseline exige apagar e recriar conscientemente os bancos de
desenvolvimento/teste. Nao se edita um banco com migrations antigas aplicadas e
nao se usa `flyway repair` para mascarar checksums divergentes.

## Decisoes fora do escopo

- ficha tecnica e multiplos insumos automaticos por produto;
- producao, cozinha e entrega;
- compras, fornecedores, custo medio, lote e validade;
- reserva de mesa;
- estorno/devolucao de pagamento;
- integracao fiscal;
- alteracao de roles e autorizacao nesta remodelagem.

Esses pontos so entram por decisao posterior, sem contaminar o modelo basico de
venda.
