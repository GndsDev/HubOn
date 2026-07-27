# Relatório de consolidação e homologação de catálogo, pedidos e estoque

Data da validação: 27/07/2026  
Branch analisada: `feat/stock-intelligent`

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

O banco local já está na versão 5 e o Flyway validou as cinco migrations. Novas
alterações de esquema devem ser feitas em V6 ou posterior.

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
| Reinício da aplicação | Aprovado | múltiplos contextos Spring reiniciaram com `ddl-auto=validate` e Flyway V5 íntegro |
| Histórico de estoque | Aprovado | movimentos preservam saldos, usuário, origem, pedido, item, motivo e data |

## Auditoria visual

O script `frontend/scripts/visual-audit.mjs` abriu o Microsoft Edge em modo
headless e executou 56 verificações. Foram auditadas as telas Produtos, Pedidos,
Cozinha e Estoque, além das três etapas do cadastro, variações, escolhas, criação
do pedido, cancelamento, saída manual e menus do primeiro e do último item.

Resoluções: `1366x768`, `1440x900` e `1920x1080`.  
Temas: claro e escuro.  
Resultado: nenhum overflow horizontal, sobreposição de modal ou overlay fora da
viewport. A sidebar permaneceu com 256 px e alinhada à topbar em todas as
combinações. Evidências em `frontend/dist/visual-audit`.

## Validação técnica

| Comando | Resultado |
| --- | --- |
| `backend\\mvnw.cmd clean verify` | Aprovado: 63 testes, 0 falhas, 0 erros, JAR gerado |
| `npm test` com `CI=true` | Aprovado: 8 arquivos, 26 testes |
| `npm run build` | Aprovado: bundle de produção gerado |
| auditoria visual | Aprovado: 56 verificações |
| `git diff --check` | Executado ao final da entrega |

## Arquivos criados

- migration V5 do catálogo, pedido e estoque;
- entidades, DTOs, repositories, service e controller de opções de produto;
- DTOs de cadastro unificado, estado por item e cancelamento;
- teste de integração `CatalogOrderIntegrationTests`;
- utilitários de fluxo do catálogo, posicionamento de overlay e seus testes;
- testes de formatter, tema e tela de estoque;
- script e evidências da auditoria visual;
- documentação funcional de catálogo e fluxo de pedido/preparo.

## Arquivos alterados

Foram alterados os módulos backend de `product`, `order`, `stock`, `dashboard`,
`tab` e `shared/config`; os testes de estoque, segurança, consistência operacional
e regras financeiras; os serviços, modelos e telas frontend de Produtos, Pedidos,
Cozinha, Estoque, rotas, navegação e estilos; e a documentação de API, banco,
arquitetura, regras, roadmap e testes manuais.

Nenhum arquivo foi removido. Nenhuma operação de stage, commit, push, merge ou
pull request foi executada.

## Limitações e pendências reais

- o endpoint legado `send-to-kitchen` e alguns estados globais antigos continuam
  disponíveis somente para compatibilidade de contrato;
- ficha técnica culinária, produção, compras, fornecedores, lote, validade,
  múltiplos depósitos, custo médio, delivery e integração fiscal permanecem fora
  do MVP;
- a auditoria de interface usa dados determinísticos interceptados no navegador;
  as regras reais de persistência e transação foram validadas separadamente pelos
  testes de integração com PostgreSQL.
