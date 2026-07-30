# Relatório mensal

## Competência

O mês da venda é definido por `tabs.closed_business_date`, gravado no fechamento com o fuso `hubon.business-zone-id` (padrão `America/Sao_Paulo`). A migration V7 preenche registros anteriores a partir de `closed_at`.

Entram no relatório apenas comandas `CLOSED` que possuam ao menos um pedido não cancelado e um item fora de `DRAFT`/`CANCELED`. Comandas abertas, pedidos em rascunho e itens cancelados não compõem receita nem quantidade vendida. Cancelamentos ocorridos no mês aparecem em bloco separado.

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

A página aceita mês, ano e canal. Categoria e forma de pagamento não filtram o resumo porque os dados atuais não permitem distribuir descontos e taxas por esses recortes sem criar totais enganosos. O resumo e os produtos podem ser exportados em CSV; a página possui folha de impressão simplificada.

Somente `OWNER` e `ADMIN` acessam o endpoint e a página.
