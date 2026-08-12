# Produtos e escolhas

## Produto

O cadastro mantém somente os dados necessários à operação:

- nome;
- preço base;
- categoria opcional;
- descrição opcional;
- ativo;
- disponível;
- ordem interna de exibição.

Um produto sem categoria continua vendável e aparece no filtro **Todos**. Para
ser incluído em uma venda, o produto precisa estar ativo e disponível.

## Categorias

Categorias organizam o catálogo. Elas possuem nome, atividade e ordem de
exibição, mas não determinam o preço nem o estoque do produto.

## Grupos de escolhas

Um produto pode ter grupos com:

- nome da pergunta;
- mínimo e máximo de seleções;
- atividade;
- opções ordenadas.

Cada opção possui nome, preço adicional opcional e atividade. Um grupo com mínimo
maior que zero precisa ser respondido antes da inclusão. O preço unitário do item
é o preço base somado aos adicionais selecionados.

Exemplo:

```text
Jantinha                              R$ 20,00
Escolha o espeto (1 escolha)
- Carne                                + R$ 0,00
- Frango                               + R$ 0,00
- Coração                              + R$ 2,00
```

## Estoque automático

O produto pode consumir um item de estoque por venda. Uma escolha também pode
consumir seu próprio item por seleção. Esses vínculos são opcionais e não
transformam o produto em receita ou ficha técnica.

## Fora do modelo

O catálogo atual não possui variação vendável, código interno por combinação,
imagem ou fluxo de produção. O preço pertence diretamente ao produto, e escolhas
apenas acrescentam valor quando configuradas.
