# Plano de implementacao da simplificacao

## Limites desta etapa

Este documento planeja a implementacao, mas nao a inicia. Nesta etapa:

- nenhuma entidade Java foi alterada;
- nenhum componente Angular foi alterado;
- nenhuma migration existente foi removida ou reescrita;
- nenhum banco foi recriado;
- nenhum endpoint ou role foi alterado.

## Inventario de impacto

### Estruturas reutilizadas

- `roles`, `users` e `user_roles`, sem mudar roles nesta remodelagem;
- `categories`, com responsabilidade reduzida a organizacao;
- `product_option_groups` e `product_options`, sem `required`;
- `restaurant_tables`, sem status persistido;
- `cash_shifts` e `cash_movements`;
- `payments`, trocando a FK de comanda para venda;
- a estrategia de ledger e saldo atual transacional do estoque;
- `Clock` de negocio e `closed_business_date`;
- locking pessimista e tratamento de conflitos existentes.

### Estruturas alteradas ou substituidas

| Atual | Alvo | Mudanca principal |
| --- | --- | --- |
| `tabs` | `sales` | Agregado definitivo, auditoria de fechamento/cancelamento e mesa derivada. |
| `order_items` | `sale_items` | Item direto, sem preparo, com snapshots e cancelamento. |
| `order_item_options` | `sale_item_options` | Snapshot de opcao ligado diretamente ao item vendido. |
| `products` | `products` | Preco volta ao produto, categoria fica opcional e saem imagem, fluxo e variacao. |
| `ingredients` | `stock_items` | Nome generico; saem modo de controle e estoque ideal. |
| `product_stock_links` | `product_stock_links` | FK passa de variacao para produto. |
| `inventory_movements` | `stock_movements` | Delta assinado, origem em item vendido e estorno explicito. |
| `payments.tab_id` | `payments.sale_id` | Pagamento pertence a venda. |
| `restaurant_tables` | `restaurant_tables` | Saem `status`, `OCCUPIED` e `RESERVED`; ocupacao e derivada. |

### Estruturas removidas

- tabela e entidade `RestaurantOrder`/`orders`;
- `ProductVariant`/`product_variants`;
- `OrderStatus`, `OrderItemStatus` e `OrderType`;
- `PreparationFlow`;
- SKU no dominio alvo;
- confirmacao, envio, preparo, pronto e entrega;
- imagem de produto e `product.image_url`;
- `required` nos grupos de opcoes;
- `control_mode` e `ideal_stock` do estoque;
- `identification_note` e `category.description` do modelo alvo.

### Novas estruturas conceituais

- `Sale`/`sales`;
- `SaleItem`/`sale_items`;
- `SaleItemOption`/`sale_item_options`;
- `StockItem`/`stock_items`;
- `StockMovement`/`stock_movements`.

Sao novos nomes e limites de dominio, embora parte dos dados venha de conceitos
atuais.

## Dependencias atuais importantes

### Backend

- `tab`: abertura, fechamento, cancelamento, totalizacao e fluxo de balcao;
- `order`: criacao/edicao de rascunho, confirmacao, preparo, cancelamento,
  snapshots e baixa de estoque;
- `product`: preco e disponibilidade por variante, opcoes e cadastro composto;
- `payment`: lock de comanda, soma paga, caixa aberto e inicio de preparo;
- `stock`: vinculo por variante, baixa na confirmacao e estorno por pedido;
- `table`: sincronizacao de `OCCUPIED` com comanda;
- `cash`: consulta pagamentos e cancelamentos de `OrderItem`;
- `dashboard`: contadores de pedido/preparo e ranking por `OrderItem`;
- `report`: SQL nativo fortemente ligado a `tabs`, `orders`, variantes e status;
- `shared/config/DataSeeder`: cria produtos com variante `Padrao` e roles;
- `shared/config/SecurityConfig`: possui caminhos dos modulos atuais.

Arquivos mais afetados:

```text
backend/src/main/java/com/hubon/backend/tab/**
backend/src/main/java/com/hubon/backend/order/**
backend/src/main/java/com/hubon/backend/product/**
backend/src/main/java/com/hubon/backend/payment/**
backend/src/main/java/com/hubon/backend/stock/**
backend/src/main/java/com/hubon/backend/table/**
backend/src/main/java/com/hubon/backend/cash/**
backend/src/main/java/com/hubon/backend/dashboard/**
backend/src/main/java/com/hubon/backend/report/**
backend/src/main/java/com/hubon/backend/shared/config/DataSeeder.java
backend/src/main/java/com/hubon/backend/shared/config/SecurityConfig.java
backend/src/main/resources/db/migration/**
```

### Frontend

- `counter-page` e `tabs-page` montam carrinho/pedido e exibem estados de
  preparo;
- `orders-page` e todo o `order-api.service` deixam de existir;
- `products-page` possui editor de variacoes, SKU, fluxo e vinculo por variante;
- `tables-page` persiste e filtra `OCCUPIED`/`RESERVED`;
- `payment-dialog` espera pedidos e proxima acao de preparo na resposta;
- `stock-page` e seus modelos usam `Ingredient`, `controlMode`, `idealStock` e
  referencias a pedido;
- dashboard, relatorios, PDF/XLSX/CSV e caixa exibem contagens ou nomes do
  modelo antigo.

Arquivos mais afetados:

```text
frontend/src/app/app.routes.ts
frontend/src/app/app.ts
frontend/src/app/core/services/tab-api.service.ts
frontend/src/app/core/services/order-api.service.ts
frontend/src/app/core/services/product-api.service.ts
frontend/src/app/core/services/payment-api.service.ts
frontend/src/app/core/services/table-api.service.ts
frontend/src/app/core/services/ingredient-api.service.ts
frontend/src/app/core/services/inventory-movement-api.service.ts
frontend/src/app/core/services/product-stock-link-api.service.ts
frontend/src/app/core/services/cash-api.service.ts
frontend/src/app/core/services/dashboard-api.service.ts
frontend/src/app/core/services/monthly-report-api.service.ts
frontend/src/app/shared/models/{tab,order,product,payment,table,ingredient,inventory-movement,product-stock-link,cash,dashboard,monthly-report}.model.ts
frontend/src/app/shared/components/payment-dialog/**
frontend/src/app/shared/util/catalog-workflow.ts
frontend/src/app/shared/util/counter-workflow.ts
frontend/src/app/features/{counter,tabs,orders,products,tables,stock,cashier,dashboard,reports}/**
```

## Ordem de implementacao

Cada etapa deve terminar com revisao de diff. Etapas que alterem o contrato
devem atualizar backend, frontend e testes correspondentes antes de serem
consideradas concluidas.

### 1. Congelar contratos e cenarios

- registrar exemplos de mesa, balcao, pagamento dividido, estoque automatico e
  cancelamento;
- decidir os textos finais da interface sem introduzir novos recursos;
- confirmar que reserva, observacao de identificacao e devolucao financeira
  realmente ficam fora do primeiro corte;
- transformar as invariantes deste documento em uma matriz de testes.

Resultado: escopo funcional fechado antes do corte estrutural.

### 2. Preparar a baseline limpa

- substituir, somente apos autorizacao, `V1` a `V9` por
  `V1__initial_schema.sql` baseado em `simplified-schema.sql`;
- criar `V2__seed_roles.sql` apenas com roles estruturais atuais;
- manter dados demonstrativos fora de `db/migration`;
- adaptar `DataSeeder` para produto com preco direto, mesas simples e usuarios
  configurados;
- recriar exclusivamente bancos locais e de teste, nunca um banco nao
  confirmado;
- validar Flyway e `spring.jpa.hibernate.ddl-auto=validate` em banco vazio.

Resultado: schema alvo reproduzivel, sem cadeia de compatibilidade.

### 3. Simplificar catalogo

- mover `price` para `Product`;
- tornar `category_id` opcional sem usar categoria para validar vendabilidade;
- remover `image_url` do dominio, DTOs e persistencia;
- remover `ProductVariant`, repositories, DTOs, services e controller;
- remover `PreparationFlow` e SKU;
- simplificar grupos de opcoes removendo `required`;
- validar minimo/maximo e pertencimento das opcoes;
- ligar `ProductStockLink` diretamente ao produto;
- adaptar cadastro composto e seed de desenvolvimento.

Resultado: cada produto retornado pela API e diretamente vendavel.

### 4. Introduzir o agregado `Sale`

- substituir o pacote `tab` por `sale`, preservando os nomes de interface
  `Comandas` e `Balcao` quando forem mais claros para o usuario;
- criar `Sale`, `SaleItem`, `SaleItemOption` e enums `SaleType`/`SaleStatus`;
- criar repositories com locks pessimistas e consultas de totais;
- derivar subtotal, valor final, valor pago e restante sem persisti-los em
  `Sale`;
- adicionar item diretamente com snapshots e sem estado intermediario;
- manter o snapshot de categoria nulo quando o produto nao estiver categorizado;
- implementar cancelamento logico e imutabilidade apos fechamento;
- corrigir item efetivado somente por cancelamento seguido de novo lancamento;
- remover o pacote `order` quando nenhuma referencia restar.

Resultado: fluxo comercial sem pedido e sem preparo.

### 5. Adaptar estoque

- renomear `Ingredient` para `StockItem` em dominio, contrato e interface;
- remover `StockControlMode` e estoque ideal;
- substituir `InventoryMovement` por `StockMovement` com delta assinado;
- implementar baixa no momento da inclusao do item;
- bloquear saldos em ordem deterministica;
- implementar `SALE_REVERSAL` idempotente por movimento original;
- impedir saldo negativo e alteracao de unidade com historico.

Resultado: item vendido e saida fisica confirmados no mesmo commit.

### 6. Adaptar pagamentos, fechamento e caixa

- trocar `tab_id` por `sale_id` em entidades, DTOs e queries;
- manter soma paga derivada e pagamento dividido;
- serializar pagamentos pelo lock de `Sale`;
- impedir alteracao/cancelamento de item depois do primeiro pagamento;
- impedir cancelamento de venda com pagamento enquanto nao houver estorno
  financeiro;
- remover qualquer dependencia de preparo da resposta de pagamento;
- fechar venda de balcao automaticamente no pagamento integral;
- exigir fechamento explicito para balcao de valor zero e rejeitar venda vazia;
- manter venda de mesa aberta ate comando explicito de fechamento;
- permitir fechamento explicito de mesa com valor zero quando houver item ativo;
- adaptar Caixa para itens cancelados e origem da venda;
- preservar turno unico, suprimento, sangria e conferencia.

Resultado: financeiro independente de workflow operacional.

### 7. Derivar estado das mesas

- remover `TableStatus` persistido;
- adicionar consulta eficiente da venda aberta por mesa;
- bloquear a mesa durante abertura e confiar tambem no indice parcial unico;
- bloquear renumeracao/desativacao durante venda aberta;
- retornar estado derivado nos DTOs, se a interface ainda precisar de um campo
  calculado.

Resultado: ocupacao possui uma unica fonte da verdade.

### 8. Reconstruir dashboard e relatorios

- reescrever SQL de relatorio para `sales`, `sale_items` e `payments`;
- remover agrupamento por variante e contagem de pedidos;
- preservar snapshots de produto/categoria e filtros `TABLE`/`COUNTER`;
- adaptar cancelamentos para venda/item;
- adaptar dashboard para vendas abertas, receita, itens, pagamentos e mesas
  derivadas;
- atualizar DTOs, HTML Thymeleaf do PDF, planilhas e CSV;
- confirmar totais iguais entre tela, PDF, XLSX e CSV.

Resultado: nenhuma metrica depende de status removido.

### 9. Simplificar o Angular

- criar modelos e servico de API de venda;
- fazer Comandas e Balcao adicionarem itens diretamente;
- remover botoes e textos de criar/salvar/confirmar pedido, preparo e entrega;
- remover rota, pagina, servico e modelos de Pedidos;
- simplificar Produtos para preco direto e vinculo de estoque por produto;
- simplificar Mesas para livre/ocupada/desativada derivados;
- renomear Ingrediente para Item de estoque na interface;
- simplificar dialogo de pagamento e proximas acoes;
- manter Design System, acessibilidade, temas e responsividade existentes.

Resultado: o usuario ve somente o fluxo operacional acordado.

### 10. Atualizar documentacao e homologar

- atualizar README, arquitetura, banco, regras, API, roadmap e glossario;
- marcar ADRs de preparo/variantes como substituidos, sem apagar a historia;
- atualizar screenshots e roteiro manual apenas depois da interface estabilizar;
- executar suites completas e homologacao manual;
- revisar que roles e regras de acesso nao mudaram acidentalmente.

Resultado: entrega coerente entre codigo, banco, interface e documentacao.

## Estrategia de testes

### Backend de integracao

- banco vazio recebe a baseline e passa na validacao JPA;
- abre mesa uma vez e rejeita duas aberturas concorrentes;
- deriva mesa ocupada sem coluna de status;
- cria venda de balcao sem mesa;
- adiciona item simples e item com opcoes, congelando todos os snapshots;
- vende produto sem categoria e nao usa categoria para validar vendabilidade;
- rejeita produto inativo/indisponivel e grupo ou opcao selecionada inativa;
- respeita minimo/maximo e opcao pertencente ao produto;
- baixa estoque ao adicionar e faz rollback de item/movimento/saldo quando falta
  estoque;
- duas vendas concorrentes disputando a ultima unidade produzem um unico
  sucesso;
- cancelar item estorna uma vez, mesmo com repeticao ou concorrencia;
- rejeita alteracao e cancelamento de item depois de qualquer pagamento;
- rejeita cancelamento de venda com pagamento;
- soma pagamento dividido e rejeita pagamento excedente, inclusive concorrente;
- exige caixa aberto para novo pagamento operacional;
- fecha balcao automaticamente no pagamento integral;
- nao fecha balcao de valor zero automaticamente e nunca fecha venda vazia;
- fecha mesa explicitamente com item ativo e pagamento exato, inclusive quando
  o valor final derivado for zero;
- fechamento concorrente com item/pagamento e serializado;
- venda e pagamento historicos nao mudam apos alteracao do catalogo;
- cash shift calcula dinheiro, suprimento, sangria e diferenca corretamente;
- relatorios diario, mensal e anual conciliam venda, item, pagamento e
  cancelamento;
- autorizacao existente continua coberta.

Suites atuais a substituir ou adaptar:

```text
CatalogOrderIntegrationTests
CounterSalesAndMonthlyReportsIntegrationTests
FinancialRulesIntegrationTests
OperationalConsistencyIntegrationTests
PaymentPreparationRollbackIntegrationTests
StockIntegrationTests
TableNumberTabsIntegrationTests
CashShiftIntegrationTests
DataSeederIntegrationTests
SecurityAuthorizationIntegrationTests
ReportPdfServiceTests
ReportWorkbookServiceTests
```

### Frontend

- cadastro de produto sem variante;
- selecao de opcoes e calculo do item;
- inclusao e cancelamento direto em Mesa e Balcao;
- pagamento parcial, dividido, integral e excedente;
- fechamento automatico do Balcao;
- estado derivado das mesas;
- estoque manual, baixa automatica e historico;
- caixa e relatorios sem estados de preparo;
- ausencia da rota e navegacao de Pedidos;
- foco, ESC, overlays, estados disabled e ambos os temas.

### Comandos de verificacao futuros

Somente depois da implementacao e com banco de teste confirmado:

```powershell
cd backend
.\mvnw.cmd clean verify

cd ..\frontend
npm test
npm run build
npm run visual:audit
```

## Riscos e mitigacoes

| Risco | Impacto | Mitigacao |
| --- | --- | --- |
| Troca da baseline em banco com historico Flyway | Aplicacao nao inicia por checksum/schema divergente. | Recriar apenas bancos locais/teste confirmados; manter backup Git; documentar o procedimento. |
| Corte simultaneo de Tab/Order/Variant | Grande quantidade de referencias deixa o build temporariamente quebrado. | Implementar por contexto, revisar `rg` de referencias e concluir o corte backend antes de integrar o frontend. |
| Alterar ou cancelar item depois de pagamento | Pode invalidar a composicao financeira ja recebida. | Rejeitar qualquer alteracao/cancelamento de item depois do primeiro pagamento; devolucao fica fora do MVP. |
| Balcao com total zero | Nao existe pagamento positivo para disparar auto fechamento. | Nao fechar automaticamente; permitir fechamento explicito somente com item ativo. |
| Renumerar mesa aberta | Tela atual e snapshot podem divergir. | Bloquear renumeracao/desativacao enquanto houver venda aberta. |
| Saldo cache divergir do ledger | Estoque operacional incorreto. | Atualizacao atomica, formula de saldo no movimento e teste/consulta futura de conciliacao. |
| Deadlock em operacao com varios itens | Transacao abortada sob concorrencia. | Ordem global de locks e timeout traduzido em repeticao segura. |
| Relatorios ainda contarem pedidos/variantes | Numeros e layouts incoerentes. | Reescrever consultas e DTOs juntos; reconciliar tela/PDF/XLSX/CSV com fixtures iguais. |
| Cancelamento exibido no Caixa sem devolucao | Usuario pode interpretar cancelamento como dinheiro devolvido. | Separar claramente cancelamento operacional de devolucao financeira; nao alterar caixa esperado sem Payment de estorno. |
| Remocao de reserva ou identificacao complementar | Pode eliminar necessidade ainda nao confirmada. | Confirmar esses dois pontos antes da fase de codigo; imagem de produto ja foi removida por decisao arquitetural. |
| Data comercial e fuso | Venda perto da meia-noite cai no periodo errado. | Continuar usando `Clock` de negocio e preencher `closed_business_date` no fechamento. |

## Criterios de conclusao

- nenhum codigo referencia `RestaurantOrder`, `ProductVariant`,
  `PreparationFlow`, `OrderStatus` ou `OrderItemStatus`;
- banco novo sobe apenas com a baseline e dados estruturais;
- nenhuma mesa possui ocupacao persistida;
- inclusao/cancelamento de item e estoque sao atomicos e idempotentes;
- subtotal, valor final, valor pago e restante sao sempre derivados;
- itens e venda nao podem ser cancelados depois de pagamento sem fluxo
  financeiro proprio;
- relatorios usam somente venda, item, pagamento e movimento;
- backend e frontend compilam e todas as suites passam;
- fluxos Mesa e Balcao sao homologados nos temas claro/escuro e resolucoes do
  projeto;
- documentacao e contrato HTTP refletem o sistema entregue.
