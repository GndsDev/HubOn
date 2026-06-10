# Roteamento do frontend

O HubOn usa Angular Router como navegação principal. A configuração está em:

- `frontend/src/app/app.routes.ts`
- `frontend/src/app/app.config.ts`
- `frontend/src/app/app.ts`
- `frontend/src/app/app.html`

## Rotas

| URL | Tela |
| --- | --- |
| `/dashboard` | Dashboard |
| `/mesas` | Mesas |
| `/comandas` | Comandas |
| `/pedidos` | Pedidos |
| `/cozinha` | Cozinha |
| `/caixa` | Caixa |
| `/categorias` | Categorias |
| `/produtos` | Produtos |
| `/relatorios` | Relatórios |
| `/usuarios` | Usuários |

A rota vazia e qualquer rota desconhecida redirecionam para `/dashboard`.

## Layout

O componente raiz mantém somente:

- sidebar agrupada;
- topbar;
- estado recolhido/expandido;
- drawer mobile;
- `<router-outlet>`;
- toast global.

Cada item do menu usa `routerLink` e `routerLinkActive`. As páginas são
carregadas sob demanda com `loadComponent`, reduzindo o bundle inicial.

## Comportamento esperado

- Atualizar o navegador preserva a tela atual.
- URLs podem ser abertas diretamente.
- O item ativo continua destacado com a sidebar recolhida.
- No mobile, navegar fecha o drawer.
- A sidebar não altera a URL por estado interno.
