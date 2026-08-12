# Temas do frontend

`ThemeService` mantém `light` ou `dark` em um signal e persiste a escolha em
`localStorage` pela chave `hubon-theme`. Sem preferência válida, o tema claro é o
padrão. O serviço aplica `data-theme` no elemento `<html>`.

As variáveis semânticas ficam em `frontend/src/styles.css`. Componentes devem
usar tokens de superfície, texto, borda, ação, feedback e sombra, evitando cores
fixas que percam contraste ao trocar de tema.

## Verificação manual

1. Alternar o tema pelo botão da barra superior.
2. Conferir navegação, cards, tabelas, formulários, badges, menus e dialogs.
3. Recarregar e confirmar a preferência.
4. Validar foco, hover, ativo e desabilitado nos dois temas.
5. Conferir ausência de texto sobreposto e overflow em desktop e tablet.

Para limpar somente a preferência durante desenvolvimento:

```js
localStorage.removeItem('hubon-theme');
```
