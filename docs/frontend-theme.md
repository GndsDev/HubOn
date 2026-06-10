# Temas do frontend

## Funcionamento

O `ThemeService` mantém o tema atual em um signal com os valores `dark` ou `light`.
Na inicialização, o serviço consulta a chave `hubon-theme` no `localStorage`. Quando
não existe uma preferência válida, o tema escuro é usado como padrão.

Ao alternar o tema, o serviço:

1. Atualiza o signal.
2. Salva a preferência em `localStorage`.
3. Define `data-theme="dark"` ou `data-theme="light"` no elemento `<html>`.

O botão da topbar consome o signal diretamente. No tema escuro ele mostra um sol,
indicando a ação de ativar o tema claro. No tema claro ele mostra uma lua.

## Variáveis CSS

As variáveis ficam no início de `frontend/src/styles.css`:

- `:root` e `:root[data-theme="dark"]` definem o visual escuro.
- `:root[data-theme="light"]` redefine as mesmas variáveis para o visual claro.

Para adicionar uma nova cor reutilizável:

1. Crie a variável no bloco dark.
2. Defina a variação correspondente no bloco light.
3. Use `var(--nome-da-variavel)` nos componentes.

Prefira variáveis para fundos, superfícies, textos, bordas e sombras. Cores
semânticas específicas, como badges de sucesso ou erro, podem ter ajustes próprios
por tema.

## Teste manual

1. Inicie o frontend.
2. Clique no botão de sol ou lua na topbar.
3. Confira sidebar, cards, formulários, modais, tabelas e badges.
4. Recarregue a página e confirme que o tema escolhido foi preservado.
5. Teste também com a sidebar recolhida e em largura mobile.

Para limpar a preferência durante testes:

```js
localStorage.removeItem('hubon-theme');
```

O próximo carregamento voltará ao tema escuro padrão.
