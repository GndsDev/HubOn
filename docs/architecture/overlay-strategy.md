# Estratégia de overlays

Todos os diálogos e menus flutuantes são renderizados em `#hubon-overlay-root`, filho direto do `body`. Isso evita clipping e novos contextos de empilhamento criados por cards, tabelas, sidebar ou conteúdo com `overflow`.

`OverlayStackService` controla a ordem por profundidade sem números de `z-index` espalhados pelos componentes. `AccessibleDialogDirective` move o backdrop para a raiz, bloqueia a rolagem da página, leva o foco ao diálogo, prende `Tab`/`Shift+Tab`, fecha apenas o overlay superior com `Escape` e devolve o foco ao acionador. `BodyPortalDirective` aplica a mesma raiz a menus sem bloquear a rolagem.

Menus continuam usando `calculateOverlayPosition`: escolhem abertura acima ou abaixo, alinham horizontalmente e limitam a altura dentro da viewport. Gerenciamentos internos trocam o diálogo principal; somente confirmações leves podem ficar temporariamente acima dele.
