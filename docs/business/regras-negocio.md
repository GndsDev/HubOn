# Regras de negócio

Este documento resume as invariantes do domínio atual. Os detalhes operacionais
estão nos documentos de cada módulo.

## Acesso

- O login usa nome de usuário e senha.
- O nome de usuário é aparado e convertido para minúsculas.
- Somente usuários ativos autenticam.
- O fluxo atual permite ao Dono criar usuários Gerentes.
- A autorização do backend prevalece sobre menus e guards do frontend.

## Vendas

- Toda venda nasce `OPEN` e é `TABLE` ou `COUNTER`.
- Uma comanda exige número de mesa positivo.
- Não podem existir duas comandas abertas para o mesmo número de mesa.
- Uma venda de balcão não aceita número de mesa.
- Venda vazia não recebe pagamento nem pode fechar.
- Os valores são derivados de itens ativos, taxa, desconto e pagamentos.
- Pagamentos não podem exceder o valor restante e exigem caixa aberto.
- Depois do primeiro pagamento, itens e a própria venda não podem ser alterados
  ou cancelados.
- Balcão com valor positivo fecha automaticamente ao ser integralmente pago.
- Comanda integralmente paga exige fechamento explícito.
- Venda com total zero exige ao menos um item ativo e fechamento explícito.

## Itens

- Produto precisa estar ativo e disponível no momento da inclusão.
- Quantidade é sempre maior que zero.
- Nome, categoria, preço base, preço final e escolhas são preservados em snapshots.
- Remover corrige um lançamento sem criar métrica de cancelamento.
- Cancelar exige motivo e registra responsável e data.
- Remoção e cancelamento revertem a baixa automática de estoque quando existir.

## Catálogo

- Produto possui preço próprio e pode existir sem categoria.
- Categoria organiza a consulta, mas não é requisito para venda.
- Grupos de escolhas definem limites mínimo e máximo.
- Escolhas podem acrescentar valor e possuir vínculo próprio de estoque.

## Estoque

- Saldos nunca podem ficar negativos.
- Toda mudança de saldo gera um `StockMovement`.
- Saldo atual e ledger são atualizados na mesma transação.
- Baixas automáticas usam o vínculo ativo do produto e os vínculos das escolhas.
- Movimentos históricos não são editados.

## Caixa

- Existe no máximo um turno aberto.
- Todo pagamento pertence ao turno aberto no momento do recebimento.
- Suprimento e sangria exigem valor positivo e observação.
- O esperado em dinheiro é saldo inicial + recebimentos em dinheiro + suprimentos
  - sangrias.
- Diferença no fechamento exige observação.

## Relatórios

- Receita considera somente vendas fechadas no período.
- Itens removidos não aparecem em vendas nem em cancelamentos.
- Cancelamentos consideram vendas e itens cancelados com motivo.
- Filtros de origem usam `ALL`, `TABLE` e `COUNTER`.

Consulte [Vendas](sales.md), [Produtos](products.md),
[Estoque](stock-management.md), [Caixa](cash-shifts.md) e
[Relatórios](reports.md).
