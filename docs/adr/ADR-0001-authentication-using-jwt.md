# ADR-0001 Authentication using JWT

Data: 2026-06-25
Status: Aceito

## Contexto

O HubOn possui frontend Angular e backend Spring Boot comunicando por HTTP/JSON.
O MVP precisa proteger endpoints operacionais e identificar o usuario
responsavel por acoes como abrir comanda, criar pedido e registrar pagamento.

## Problema

O sistema precisa autenticar usuarios e enviar identidade/autorizacao em cada
requisicao sem depender de sessao de servidor.

## Alternativas consideradas

- Sessao HTTP tradicional no servidor.
- JWT stateless.
- API sem autenticacao durante o MVP.

## Decisao

Usar JWT stateless no MVP. O login retorna token, dados publicos do usuario e
roles. O frontend envia `Authorization: Bearer <token>` nas chamadas protegidas.
O backend valida o token e aplica regras de autorizacao por perfil.

## Consequencias

- A API permanece stateless.
- O backend consegue obter o usuario autenticado para autoria operacional.
- Endpoints protegidos retornam `401` sem token valido e `403` sem permissao.
- Refresh token, recuperacao de senha e hardening ficam planejados para fase de
  seguranca.

## Status

Aceito.

## Data

2026-06-25.
