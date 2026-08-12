# Vendas, Comandas e Balcão

## Modelo

`Sale` representa todo atendimento comercial:

| Tipo | Uso | Identificação |
| --- | --- | --- |
| `TABLE` | Comanda | `tableNumber` positivo |
| `COUNTER` | Balcão | ID da venda, sem número de mesa |

Os estados possíveis são `OPEN`, `CLOSED` e `CANCELLED`. O número de mesa não é
uma entidade cadastrada: ele é informado ao abrir a comanda. Uma restrição no
banco impede duas vendas `TABLE` abertas com o mesmo número.

## Valores

O backend calcula:

```text
subtotal = soma dos itens ativos
valor final = max(subtotal + taxa de serviço - desconto, 0)
pago = soma dos pagamentos
restante = valor final - pago
```

Esses totais são respostas derivadas e não colunas persistidas da venda. Taxa de
serviço e desconto são armazenados na `Sale`.

## Inclusão de itens

Um produto simples entra com um clique. Produtos com grupos obrigatórios pedem
somente as escolhas necessárias. O backend valida produto ativo/disponível,
quantidade positiva e limites dos grupos.

O `SaleItem` guarda snapshots de nome, categoria, preço base, preço unitário e
subtotal. Cada escolha guarda nome do grupo, nome da opção e preço adicional.
Assim, alterações futuras no catálogo não mudam o histórico.

## Quantidade, remoção e cancelamento

- Quantidade pode ser alterada enquanto a venda está aberta e sem pagamentos.
- **Remoção** corrige um lançamento sem exigir motivo. O item deixa a resposta
  operacional, mas sua autoria e data permanecem no banco. A baixa de estoque é
  revertida e o evento não compõe métricas de cancelamento.
- **Cancelamento** representa uma ocorrência de negócio. Exige motivo, registra
  responsável/data, permanece visível no histórico da venda e compõe relatórios.

Após qualquer pagamento, itens ficam imutáveis e a venda não pode ser cancelada,
pois o sistema ainda não implementa estorno financeiro.

## Pagamentos

Uma venda aceita múltiplos pagamentos em `CASH`, `PIX`, `DEBIT_CARD`,
`CREDIT_CARD` ou `VOUCHER`. Cada valor deve ser positivo e não pode ultrapassar o
restante. É obrigatório existir um turno de caixa aberto.

## Fechamento

### Balcão

Uma venda de balcão com valor positivo fecha automaticamente quando o pagamento
integral é registrado. Pagamento parcial mantém a venda aberta. Total zero não
gera pagamento e exige fechamento explícito.

### Comanda

A comanda permanece aberta após a quitação. O usuário confirma o fechamento e o
número de mesa fica disponível para uma nova venda.

Em ambos os fluxos, venda vazia não fecha e o total pago precisa ser exatamente
igual ao valor final.

## Histórico

A tela Histórico consulta `Sale` e apresenta vendas fechadas ou canceladas, com
filtros de período, origem e situação. Itens, escolhas e pagamentos são mostrados
pelos snapshots e registros imutáveis devolvidos pela API.
