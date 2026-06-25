# ADR-0002 Role hierarchy

Data: 2026-06-25
Status: Aceito

## Contexto

O HubOn atende perfis diferentes dentro da operacao: dono, administrador,
garcom, cozinha e caixa.

## Problema

Usuarios nao devem acessar modulos ou criar perfis acima da sua responsabilidade.

## Alternativas consideradas

- Um unico perfil administrativo.
- Permissoes granulares por acao desde o MVP.
- Hierarquia simples de roles operacionais.

## Decisao

Usar roles `OWNER`, `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`.

`OWNER` pode criar `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`. `ADMIN` pode criar
apenas `WAITER`, `KITCHEN` e `CASHIER`. Roles operacionais nao criam usuarios.

## Consequencias

- A regra fica simples para o MVP.
- A autorizacao real permanece no backend.
- O frontend pode ocultar rotas e menus, mas nao substitui a seguranca da API.
- Permissoes mais granulares podem ser avaliadas em versoes futuras.

## Status

Aceito.

## Data

2026-06-25.
