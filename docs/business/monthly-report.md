# Relatórios mensal e anual

## Competência

O período da venda é definido por `tabs.closed_business_date`, gravado no fechamento com o fuso `hubon.business-zone-id` (padrão `America/Sao_Paulo`). O relatório mensal consulta somente o mês selecionado; o anual consulta o intervalo completo de janeiro a dezembro em uma única consolidação no backend. A migration V7 preenche registros anteriores a partir de `closed_at`.

Entram no relatório apenas comandas `CLOSED` que possuam ao menos um pedido não cancelado e um item fora de `DRAFT`/`CANCELED`. Comandas abertas, pedidos em rascunho e itens cancelados não compõem receita nem quantidade vendida. Cancelamentos ocorridos no período aparecem em bloco separado.

## Indicadores

- receita bruta: soma de `total_amount + service_fee`;
- receita líquida: soma de `final_amount`;
- descontos e taxa de serviço: somas dos campos da comanda;
- quantidade de vendas: comandas válidas fechadas;
- pedidos e itens vendidos: pedidos e itens ativos das comandas válidas;
- ticket médio: receita líquida dividida por comandas válidas;
- recebido: pagamentos vinculados às comandas válidas do período;
- comparação: diferença absoluta e percentual contra o mês anterior; percentual fica ausente quando a base anterior é zero.

## Agrupamentos

Produtos, variações, categorias e preços usam snapshots do item. Produto é consolidado sem misturar categorias históricas, e as variações continuam separadas no detalhamento. Também existem agrupamentos por forma de pagamento, canal (`TABLE`/`COUNTER`) e dia comercial. Participações percentuais usam o total do próprio agrupamento; descontos e taxas não são rateados entre produtos.

Cancelamentos informam pedidos cancelados, itens cancelados, valor dos itens e os cinco motivos mais frequentes quando há dados suficientes.

## Filtros e exportação

A página alterna entre os períodos mensal e anual e aceita ano e canal; o mês aparece somente no período mensal. Categoria e forma de pagamento não filtram o resumo porque os dados atuais não permitem distribuir descontos e taxas por esses recortes sem criar totais enganosos. O menu exporta o resumo e os produtos em CSV. O botão `Baixar PDF` solicita ao backend o documento diagramado com Thymeleaf, sem imprimir a rota Angular e sem incluir URL, data ou título automático do navegador.

### Ordenação de produtos

A ordenação atua somente sobre os produtos consolidados já recebidos para o período e o canal selecionados. No mensal, considera os totais do mês; no anual, os totais do ano inteiro. O mesmo componente atende as duas visões, não dispara uma nova consulta ao backend e fica registrado na URL pelos parâmetros `sort` e `direction`.

- **Faturamento:** usa o valor total vendido (`salesAmount`). A direção padrão é decrescente; empates usam maior quantidade e, depois, nome em ordem alfabética `pt-BR`.
- **Quantidade:** usa o total de unidades vendidas (`quantity`). A direção padrão é decrescente; empates usam maior faturamento e, depois, nome em ordem alfabética `pt-BR`.
- **Nome:** usa ordem alfabética `pt-BR`, sem priorizar diferenças entre maiúsculas e minúsculas. A direção padrão é crescente; empates usam maior faturamento e maior quantidade.

O usuário pode inverter a direção do critério ativo. Ao escolher outro critério, a direção volta ao padrão correspondente. A contagem exibida representa produtos consolidados, não unidades vendidas. Com zero ou um produto, os controles são ocultados e a própria interface informa por que não há ordenação disponível.

As variações continuam dentro do respectivo produto e possuem ordem empresarial fixa: maior faturamento, maior quantidade e nome. Produtos de categorias históricas diferentes não são mesclados.

O CSV de produtos recebe a mesma lista ordenada exibida na interface, incluindo a ordem interna das variações. O CSV de resumo não depende dessa preferência. O PDF Thymeleaf usa sempre faturamento decrescente, quantidade decrescente em caso de empate e nome, mantendo documentos comparáveis. Os endpoints de PDF não recebem `sort` nem `direction`.

O relatório anual devolve também uma série com os doze meses, incluindo meses sem movimento com valores zerados. A interface consome diretamente essa resposta consolidada; não soma doze respostas mensais no navegador.

Somente `OWNER` e `ADMIN` acessam o endpoint e a página.
