# Relatório de consolidação e homologação de catálogo, pedidos e estoque

Data da validação: 27/07/2026  
Branch analisada: `fix/stabilize-catalog-stock`

A consolidação de catálogo, pedidos e estoque foi commitada em `5a87686` e
mesclada na PR #4. Esta estabilização parte do merge `0c251fa`, já presente em
`main`, e limita-se às correções descritas neste relatório.

## Diagnóstico inicial

A branch continha uma evolução parcial do estoque híbrido e das variações. O
catálogo ainda combinava conceitos antigos e novos: o fluxo `KITCHEN` coexistia
com o fluxo operacional pretendido, o preço ainda existia no produto base em
partes do backend e a baixa automática dependia do envio para a cozinha. Pedidos
tinham estado principalmente global, não possuíam escolhas estruturadas e não
separavam corretamente itens de preparo e entrega direta.

Também foram encontrados os seguintes problemas de interface:

- cadastro de produto e variação fragmentado;
- excesso de ações por linha nas telas de Produtos e Estoque;
- dropdown de Estoque preso ao contexto de empilhamento da lista;
- sidebar e área de conteúdo com medidas divergentes;
- ausência de seleção operacional para variações e escolhas;
- fila de preparo dependente de filtragem no frontend.

## Decisões de modelagem

- `Product` concentra os dados comerciais gerais, sem preço.
- `ProductVariant` é a unidade vendável e a única fonte de preço.
- `ProductOptionGroup`, `ProductOption` e `OrderItemOption` representam escolhas
  e preservam seus snapshots no pedido.
- `PreparationFlow` contém somente `REQUIRES_PREPARATION` e `DIRECT_SERVICE`.
- cada `OrderItem` possui estado operacional próprio.
- a confirmação do pedido é a fronteira transacional para validação, cálculo,
  bloqueio pessimista e baixa automática.
- `ProductStockLink` permanece vinculado à variação e aceita somente item
  `DIRECT_SALE`.
- cancelamentos preservam histórico e geram `REVERSAL` apenas quando houve
  movimento automático correspondente.
- o endpoint legado `send-to-kitchen` foi mantido como alias temporário de
  compatibilidade; a regra principal usa confirmação.

## Migração

Foi criada a migration
`V5__consolidate_catalog_order_and_inventory.sql`, sem alterar V1 a V4. Ela:

- converte `KITCHEN` em `REQUIRES_PREPARATION`;
- adiciona disponibilidade e ordenação a produtos e variações;
- cria grupos, opções e snapshots de escolhas;
- adiciona confirmação, cancelamento e estados por item;
- cria o tipo `SALE` e sua restrição lógica de idempotência;
- conclui a transferência de preço e vínculos para a variação;
- remove `products.price` somente depois da migração dos dados.

Nesta estabilização foi criada, sem alterar a V5 já aplicada, a migration
`V6__correct_legacy_direct_service_order_status.sql`. Ela move para `READY`
somente itens legados `DIRECT_SERVICE` presos em `WAITING_PREPARATION` ou
`IN_PREPARATION` e libera conservadoramente pedidos sem itens pendentes.

O banco exclusivo `hubon_test` está na versão 6. O Flyway validou V1 a V6 e o
Hibernate iniciou com `spring.jpa.hibernate.ddl-auto=validate`.

## Fluxos consolidados

O cadastro de produto usa um assistente de três etapas: informações gerais,
variações e preços, e configurações opcionais. O salvamento unificado ocorre em
uma transação e o backend informa se o cadastro está completo.

Pedidos são criados como rascunho. Na confirmação, o backend recalcula preços,
valida disponibilidade e escolhas, consolida necessidades de estoque, adquire
locks em ordem estável e grava os movimentos. Itens diretos ficam `READY`; itens
de preparo ficam `WAITING_PREPARATION`. A fila da cozinha é fornecida por um
endpoint dedicado e nunca inclui entrega direta.

Estoque manual continua sendo movimentado pelas operações de entrada, saída,
perda e ajuste. Estoque automático é abatido por variação na confirmação e
estornado no cancelamento, com usuário, origem, pedido e item registrados.

## Homologação operacional

Os cenários de domínio foram executados contra PostgreSQL real pelos testes de
integração. A operação visual foi simulada em navegador real com respostas de API
determinísticas para Jantinha Completa, Coca-Cola com três variações, Porção de
Arroz com duas variações, itens indisponíveis e estoques manual e automático.

| Cenário | Resultado | Evidência |
| --- | --- | --- |
| Espeto de Carne, variação Padrão e preparo | Aprovado | cadastro sem preço base, variação simples e fluxo de preparo nos testes de catálogo |
| Coca-Cola com Lata, 600 mL e 2 L | Aprovado | múltiplas variações, faixa de preço, seleção e auditoria visual |
| Porção de Arroz Média e Grande | Aprovado | variações de preparo e simulação visual do catálogo |
| Jantinha com acompanhamento e espeto | Aprovado | mínimo, máximo, obrigatoriedade, pertencimento e snapshots das escolhas |
| Pedido apenas com bebida | Aprovado | item fica pronto, não entra na fila e baixa uma única vez |
| Pedido apenas com espeto | Aprovado | item entra na fila de preparo e aceita transições por item |
| Pedido misto | Aprovado | somente o item de preparo entra na fila; o direto fica pronto |
| Pedido com escolhas | Aprovado | escolhas são validadas e exibidas por snapshot |
| Falta de estoque | Aprovado | confirmação inteira é recusada sem saldo negativo ou efeito parcial |
| Clique repetido em confirmar | Aprovado | índice lógico e verificação transacional impedem segunda baixa |
| Cancelamento de bebida | Aprovado | gera um único `REVERSAL` com a quantidade originalmente baixada |
| Cancelamento de item em preparo | Aprovado | item fica cancelado e deixa a fila ativa |
| Cancelamento total | Aprovado | itens são cancelados na mesma transação e movimentos elegíveis são estornados |
| Alteração de preço após pedido | Aprovado | preço, nomes e escolhas anteriores permanecem nos snapshots |
| Produto indisponível | Aprovado | produto continua no cadastro, mas a API bloqueia nova venda |
| Variação indisponível | Aprovado | variação não pode ser selecionada nem confirmada |
| Pagamento e fechamento | Aprovado | regressão financeira cobre pagamento exato, saldo e liberação da mesa |
| Seeder em banco novo | Aprovado | suco e prato executivo exigem preparo; refrigerante é entrega direta; todos recebem variação Padrão com preço |
| Idempotência do seeder | Aprovado | novas execuções não duplicam catálogo, usuários, variações ou mesas |
| Segurança da cozinha | Aprovado | `KITCHEN` usa fila e estado por item, mas recebe `403` em status global, criação, confirmação, cancelamento, listagem geral e estoque |
| Correção de legado | Aprovado | itens diretos ficam prontos, pedido somente direto é liberado e pedido misto pendente continua em preparo |
| Isolamento do banco | Aprovado | todas as suítes Spring usam perfil `test`; guard validou `current_database()` como `hubon_test` |
| Reinício da aplicação | Aprovado | múltiplos contextos Spring reiniciaram com `ddl-auto=validate` e Flyway V6 íntegro |
| Histórico de estoque | Aprovado | movimentos preservam saldos, usuário, origem, pedido, item, motivo e data |

## Auditoria visual

O script `frontend/scripts/visual-audit.mjs` abriu o Microsoft Edge em modo
headless e executou 118 verificações. Foram auditadas Dashboard, Mesas,
Comandas, Produtos, Pedidos, Cozinha, Caixa, Categorias, Estoque, Relatórios e
Usuários, além dos formulários e estados auxiliares de Produto e Estoque.

Resoluções: `1366x768`, `1440x900` e `1920x1080`.  
Temas: claro e escuro.  
Resultado: nenhum overflow horizontal, sobreposição de modal ou overlay fora da
viewport. A sidebar permaneceu com 256 px e alinhada à topbar em todas as
combinações. Evidências em `frontend/dist/visual-audit`.

## Validação técnica

| Comando | Resultado |
| --- | --- |
| `backend\\mvnw.cmd clean verify` | Aprovado: 66 testes, 0 falhas, 0 erros, JAR gerado |
| `npm test` com `CI=true` | Aprovado: 8 arquivos, 28 testes |
| `npm run build` | Aprovado: bundle de produção gerado |
| auditoria visual | Aprovado: 118 verificações |
| `git diff --check` | Aprovado, sem erros de whitespace |

## Estabilização aplicada

- `DataSeeder` recebe o fluxo explicitamente em cada produto inicial;
- refrigerante seedado usa `DIRECT_SERVICE`; suco e prato executivo usam
  `REQUIRES_PREPARATION`;
- `KITCHEN` foi removido da autorização de status global do pedido;
- V6 corrige os estados legados sem tocar em rascunhos, cancelados, entregues ou
  pedidos mistos ainda pendentes;
- todas as suítes de integração usam `application-test.properties` e
  `@ActiveProfiles("test")`;
- `IntegrationTestDatabaseGuard` valida `current_database()` antes do Flyway e
  impede testes em banco cujo nome não termine em `_test` ou `-test`;
- testes adicionais cobrem seeder, autorização e comportamento da V6;
- instruções locais e modelo de banco foram atualizados para o perfil `test` e
  Flyway V6.

## Estado de publicação

A implementação anterior está commitada e foi mesclada pela PR #4. As alterações
desta estabilização permanecem apenas no working tree da branch
`fix/stabilize-catalog-stock`; não foi feita nova publicação por solicitação do
escopo. Nenhum workflow de CI/CD foi criado ou alterado, também por decisão de
escopo.

## Limitações e pendências reais

- o endpoint legado `send-to-kitchen` e alguns estados globais antigos continuam
  disponíveis somente para compatibilidade de contrato;
- ficha técnica culinária, produção, compras, fornecedores, lote, validade,
  múltiplos depósitos, custo médio, delivery e integração fiscal permanecem fora
  do MVP;
- a auditoria de interface usa dados determinísticos interceptados no navegador;
  as regras reais de persistência e transação foram validadas separadamente pelos
  testes de integração com PostgreSQL;
- o banco `hubon_test` é local e persistente; Testcontainers e workflow de CI
  permanecem fora desta estabilização.
