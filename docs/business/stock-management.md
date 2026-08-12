# Estoque

## Itens controlados

`StockItem` representa um item físico com:

- nome e descrição opcional;
- unidade `KG`, `G`, `L`, `ML`, `UN`, `CX`, `PACKAGE` ou `TRAY`;
- saldo atual;
- estoque mínimo;
- situação derivada (`NORMAL`, `LOW_STOCK` ou `OUT_OF_STOCK`);
- atividade.

Saldos e mínimos usam três casas decimais. O sistema não permite saldo negativo.

## Ledger de movimentos

Toda alteração gera um `StockMovement` com saldo anterior, delta, saldo
resultante, responsável, data e motivo quando aplicável.

| Tipo | Uso |
| --- | --- |
| `ENTRY` | entrada manual |
| `EXIT` | saída manual |
| `LOSS` | perda manual com motivo obrigatório |
| `ADJUSTMENT` | ajuste para um novo saldo com motivo obrigatório |
| `SALE` | baixa automática de venda |
| `SALE_REVERSAL` | devolução gerada por redução, remoção ou cancelamento |

O ledger é somente leitura. O `currentStock` funciona como saldo operacional e é
atualizado junto com o movimento na mesma transação.

## Movimentações manuais

Entradas, saídas e perdas exigem quantidade positiva. Ajuste recebe o novo saldo,
que deve ser diferente do atual. Perda e ajuste exigem motivo; entrada e saída
aceitam motivo opcional.

## Baixa automática

`ProductStockLink` relaciona um produto a um item de estoque e define
`quantityPerSale`. Existe no máximo um vínculo ativo por produto.

`ProductOptionStockLink` faz o mesmo para uma escolha e define
`quantityPerSelection`. Existe no máximo um vínculo ativo por escolha.

Ao adicionar um item à venda, os consumos do produto e das escolhas selecionadas
são somados por item de estoque e lançados como `SALE`. Alterações de quantidade
geram deltas. Remoção ou cancelamento gera `SALE_REVERSAL` referenciando o
movimento original quando aplicável.

Se faltar saldo ou o item vinculado estiver inativo, a operação comercial é
interrompida antes de deixar dados inconsistentes.

## Escopo

O controle automático é deliberadamente simples. Não existem ficha técnica,
receitas com múltiplos componentes, compras, fornecedores, rendimento ou
conversão automática de unidades.
