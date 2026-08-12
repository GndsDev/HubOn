# Relatórios

## Períodos e filtros

A tela oferece três períodos:

- **Diário:** uma data;
- **Mensal:** mês e ano;
- **Anual:** ano.

Todos aceitam origem `ALL`, `TABLE` ou `COUNTER`, apresentada como Todas,
Comandas e Balcão.

## Indicadores

Os relatórios consolidam somente vendas fechadas no intervalo:

- faturamento bruto, taxas, descontos e faturamento líquido;
- valor recebido, vendas concluídas, itens vendidos e ticket médio;
- quantidade por origem;
- produtos e categorias;
- formas de pagamento;
- série horária, diária ou mensal conforme o período;
- detalhes das vendas;
- cancelamentos e principais motivos;
- comparação com o período anterior.

Itens removidos não entram nos indicadores nem nas métricas de cancelamento.
Itens e vendas cancelados são contabilizados pelo momento do cancelamento.

## Exportação

O botão **Exportar dados** abre um menu compacto:

- **CSV:** detalhes das vendas já carregadas, adequado para análise simples;
- **XLSX:** planilha formatada gerada pelo backend;
- **PDF:** relatório pronto para consulta, gerado no backend com Thymeleaf e
  OpenHTMLToPDF.

O período e a origem selecionados são preservados na exportação. Não existe aba
separada de conteúdo bruto nem modal de formatos.
