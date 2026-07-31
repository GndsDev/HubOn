# Homologação operacional e visual do HubOn

> Registro histórico da revisão de 30 de julho. A divisão atual entre Balcão,
> Comandas, Pedidos e Caixa, incluindo preparo automático e remoção da tela
> exclusiva de Cozinha, está em
> [operational-refinement-homologation.md](operational-refinement-homologation.md).

Data da validação: 30 de julho de 2026.

## Escopo

Esta homologação cobre a transformação do Balcão em uma central operacional persistente e a revisão integrada de Dashboard, Mesas, Comandas, Pedidos, Cozinha, Caixa, Categorias, Produtos, Estoque, Relatório mensal, Usuários, Login e Minha Conta. As regras transacionais existentes foram preservadas.

## Diagnóstico

### Causa do desaparecimento aparente

O antigo Balcão mantinha carrinho, identificação do cliente e sinais do pedido no estado local do componente. A comanda e o pedido só eram persistidos quando o operador confirmava a venda. Antes dessa confirmação, mudar de rota ou recarregar destruía o formulário. Depois da confirmação, a venda existia no backend, mas o Balcão não consultava comandas `COUNTER` persistidas, a URL continuava genérica e o Caixa acabava sendo o único ponto evidente para reencontrá-la.

Não havia perda do registro confirmado, mas havia perda real do rascunho e uma falha estrutural de localização e continuidade operacional.

### Inconsistências encontradas

- Atendimento, preparo e financeiro eram apresentados como se fossem um único estado.
- Pagamento podia fazer a venda parecer concluída mesmo com preparo ou entrega pendente.
- Pedidos, Cozinha e Caixa repetiam ações ou exibiam ações inválidas para o estado atual.
- O menu de ações de listas podia ser recortado por contêineres com `overflow`.
- Cabeçalhos densos, principalmente na Cozinha, podiam ultrapassar o cartão em altura reduzida.
- Havia mensagens e rótulos visíveis sem acentuação correta.
- Cards, tabelas, formulários, vazios, badges e hierarquia variavam entre telas.

## Solução implementada

### Persistência e retomada

Ao selecionar **Nova venda no balcão**, o backend cria imediatamente uma comanda `COUNTER` e um pedido em rascunho. Itens, quantidades, variações, escolhas, observações e cliente opcional são salvos no backend. O atendimento recebe a rota `/balcao/{counterTabId}`, que suporta atualização da página, navegação direta e retomada sem recriação.

Uma venda de balcão permanece disponível na tela de Balcão até ser finalizada ou cancelada. Pagamento, preparo, entrega e fechamento são dimensões distintas.

A confirmação continua sendo a fronteira transacional para validação de preço, disponibilidade, baixa de estoque e envio dos itens que exigem preparo. Nenhuma baixa ou pagamento é repetido ao retomar a venda.

### Central do Balcão

- **Ativos:** todos os atendimentos ainda operacionais, inclusive rascunhos, vendas pagas em preparo e vendas entregues aguardando fechamento.
- **Finalizados hoje:** vendas encerradas no dia operacional.
- **Histórico:** busca por período, número, cliente, estado e operador.
- Cada resumo informa abertura, responsável, itens, total, pago, restante, preparo, financeiro e próxima ação.
- A navegação mostra a quantidade de atendimentos ativos e distingue, por texto e ícone, vendas prontas para entrega.
- A atualização ocorre após ações e por consulta compartilhada controlada a cada 30 segundos; não foi introduzido WebSocket.

### Estados apresentados

| Dimensão | Estados principais |
| --- | --- |
| Atendimento | Em montagem, Confirmado, Em andamento, Pronto para finalizar, Finalizado, Cancelado |
| Preparo | Sem preparo, Aguardando preparo, Em preparo, Parcialmente pronto, Pronto, Entregue |
| Financeiro | Não pago, Parcialmente pago, Pago, Cancelado |

Os estados são derivados dos registros existentes. Não foi criada coluna redundante nem migration V8.

### Integrações

- **Caixa:** separa saldo, preparo, entrega e possibilidade de fechamento; uma venda paga continua ativa enquanto houver preparo ou entrega pendente e oferece retorno ao Balcão.
- **Cozinha:** exibe apenas itens que exigem preparo, identifica Mesa ou Balcão e mostra somente `Iniciar preparo` ou `Marcar como pronto` conforme o estado.
- **Pedidos:** identifica a origem e o financeiro; vendas de Balcão retornam à central e itens pagos não oferecem cancelamento indevido.
- **Dashboard:** apresenta indicadores acionáveis para vendas de Balcão, pedidos prontos, pagamentos pendentes e demais áreas operacionais.
- **Estoque:** a confirmação continua responsável pela baixa automática idempotente; retomada, pagamento e atualização da tela não duplicam movimentos.

## Endpoints do Balcão

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| `GET` | `/api/tabs/counter/active` | Listar atendimentos ativos |
| `GET` | `/api/tabs/counter/finished-today` | Listar finalizados no dia operacional |
| `GET` | `/api/tabs/counter/history` | Pesquisar histórico |
| `GET` | `/api/tabs/counter/{id}` | Recuperar o atendimento completo |
| `POST` | `/api/tabs/counter` | Criar comanda e rascunho persistentes |
| `PATCH` | `/api/tabs/counter/{id}` | Atualizar cliente e conteúdo editável |
| `POST` | `/api/tabs/counter/{id}/finish` | Finalizar após pagamento e entrega válidos |

Os endpoints operacionais permitem `OWNER`, `ADMIN` e `CASHIER`. `WAITER` não recebeu acesso ao Balcão e a proteção por URL direta foi testada.

## Ações consolidadas

- Em montagem: `Confirmar pedido` é a única ação principal; cliente e descarte são secundários.
- Após confirmação: pagamento ou acompanhamento aparecem conforme a próxima necessidade calculada.
- Pronto: `Marcar como entregue` é a ação operacional principal.
- Entregue e pago: `Finalizar venda` aparece separadamente.
- Cozinha não oferece entrega nem repete ações de preparo concluídas.
- Pedidos não repete a confirmação do Balcão e não permite cancelar item já pago.
- Ações administrativas e pouco frequentes permanecem em menus de três pontos.

A matriz completa está em `docs/product/operational-actions-decisions.md`.

## Design e componentes compartilhados

- Variáveis semânticas de cor, superfície, borda, texto, foco, sombra, tipografia, raio e espaçamento para claro e escuro.
- Padrões comuns para botões, inputs, badges, cards, tabelas, cabeçalhos, filtros, loading, erro e estado vazio.
- `BodyPortalDirective` para retirar menus e diálogos de contêineres com `overflow`.
- `OverlayStackService` para ordem dos overlays, ESC, bloqueio de rolagem e restauração de foco.
- `AccessibleDialogDirective` para foco inicial, ciclo de Tab e retorno ao elemento acionador.
- Posicionamento de menus calculado pelo botão, com abertura acima quando necessário, ajuste horizontal e contenção na viewport.
- Cabeçalhos e itens da Cozinha agora quebram dentro do cartão sem sobreposição.

## Textos revisados

Foram corrigidos títulos, rótulos, placeholders, estados, confirmações, vazios, erros e respostas da API, incluindo variação, opção, configuração, relatório, usuário, observação, disponível, necessário, confirmação, movimentação, automático e não. Enums, rotas, contratos JSON, nomes técnicos e dados persistidos não foram alterados por estética.

## Validação manual

Foi executada uma venda real de Balcão com produto de entrega direta e produto com preparo. O atendimento foi criado, recebeu URL própria, sobreviveu a troca de rota e atualização, preservou escolhas e observação, foi confirmado, pago enquanto o preparo estava pendente, atualizado pela Cozinha, marcado como entregue, finalizado e localizado em **Finalizados hoje** e no **Histórico**.

Também foram conferidos pagamento parcial, venda mista, permanência após pagamento, retorno pelo Caixa, ausência de cancelamento em item pago, primeiro e último menu de Estoque e abertura automática do último menu acima da linha.

## Resultados automatizados

| Validação | Resultado |
| --- | --- |
| Backend `clean verify` | 83 testes, 0 falhas, Flyway validou 7 migrations em `hubon_test`, JAR gerado |
| Frontend `npm test` | 16 arquivos, 59 testes, 0 falhas |
| Frontend `npm run build` | Build de produção concluído |
| Auditoria no Microsoft Edge | 184 verificações aprovadas |
| Git `diff --check` | Concluído sem erros; nenhum arquivo em stage |

A auditoria visual cobriu temas claro e escuro em `1366x768`, `1440x900`, `1920x1080` e `1366x650`, incluindo todas as rotas operacionais, Login, Minha Conta, modais de Produtos, relatório extenso, menus do primeiro e último item, listas com rolagem e sidebar recolhida. As capturas e resultados permanecem apenas em `frontend/dist/visual-audit` e não são versionados.

## Arquivos criados nesta evolução

### Backend

- `backend/src/main/java/com/hubon/backend/tab/dto/CounterAttendanceState.java`
- `backend/src/main/java/com/hubon/backend/tab/dto/CounterFinancialState.java`
- `backend/src/main/java/com/hubon/backend/tab/dto/CounterNextAction.java`
- `backend/src/main/java/com/hubon/backend/tab/dto/CounterPreparationState.java`
- `backend/src/main/java/com/hubon/backend/tab/dto/CounterSaleDetailResponse.java`
- `backend/src/main/java/com/hubon/backend/tab/dto/CounterSaleSummaryResponse.java`
- `backend/src/main/java/com/hubon/backend/tab/dto/UpdateCounterTabRequest.java`
- `backend/src/main/java/com/hubon/backend/tab/service/CounterSaleService.java`
- `backend/src/test/java/com/hubon/backend/CounterSalesAndMonthlyReportsIntegrationTests.java`

### Frontend

- `frontend/src/app/core/services/counter-activity.service.ts`
- `frontend/src/app/core/services/counter-activity.service.spec.ts`
- `frontend/src/app/features/counter/counter-page.component.ts`
- `frontend/src/app/features/counter/counter-page.component.spec.ts`
- `frontend/src/app/shared/util/counter-workflow.ts`
- `frontend/src/app/shared/util/counter-workflow.spec.ts`

### Documentação

- `docs/business/counter-sales.md`
- `docs/product/operational-actions-decisions.md`
- `docs/testing/counter-operations-homologation.md`

## Arquivos alterados nesta evolução

### Backend

- Autenticação e segurança: `AuthenticatedUserProvider.java`, `SecurityConfig.java`, `GlobalExceptionHandler.java`.
- Dashboard: `DashboardSummaryResponse.java`, `DashboardService.java`.
- Pedidos: `RestaurantOrderRequest.java`, `RestaurantOrderResponse.java`, `RestaurantOrderRepository.java`, `RestaurantOrderService.java`.
- Balcão e comandas: `TabController.java`, `Tab.java`, `TabResponse.java`, `TabRepository.java`, `TabService.java`.
- Mensagens de Produtos e Estoque: `ProductService.java`, `ProductVariantService.java`, `ProductOptionService.java`, `IngredientService.java`, `InventoryMovementService.java`, `ProductStockLinkService.java`.
- Testes: `CatalogOrderIntegrationTests.java`, `SecurityAuthorizationIntegrationTests.java`, `StockIntegrationTests.java`.

### Frontend

- Aplicação e rotas: `app.html`, `app.ts`, `app.routes.ts`, `app.spec.ts`.
- API e modelos: `tab-api.service.ts`, `dashboard.model.ts`, `order.model.ts`, `tab.model.ts`.
- Telas: `dashboard-page.component.ts`, `orders-page.component.ts`, `kitchen-page.component.ts`, `cashier-page.component.ts`, `products-page.component.ts`, `stock-page.component.ts`, `reports-page.component.ts`, `tabs-page.component.ts` e `counter-page.component.ts`.
- Compartilhados: `accessible-dialog.directive.ts`, `body-portal.directive.ts`, `overlay-stack.service.ts`, utilitários de posicionamento e fluxo.
- Design global e auditoria: `styles.css`, `scripts/visual-audit.mjs`.

### Documentação

- `docs/README.md`
- `docs/api/endpoints.md`
- `docs/architecture/frontend-api-integration.md`
- `docs/architecture/frontend-routing.md`
- `docs/business/order-preparation-flow.md`
- `docs/business/regras-negocio.md`
- `docs/status-mvp.md`
- `docs/testing/manual-test-flow.md`
- `docs/testing/testing.md`

## Migration

Nenhuma migration existente foi alterada nesta revisão e não foi criada V8. Os estados necessários são derivados da comanda, do pedido, dos itens e dos pagamentos já persistidos.

## Pendências reais

Não há pendência funcional ou visual conhecida dentro do escopo homologado. Como evolução futura, caso o histórico cresça significativamente, a filtragem pode migrar para paginação e filtros SQL sem alterar a experiência atual do MVP.

Artefatos de build, capturas, logs, credenciais, arquivos locais e o documento externo de levantamento de requisitos não fazem parte da entrega versionável.
