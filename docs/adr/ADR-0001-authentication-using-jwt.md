# ADR-0001: Autenticação com JWT

Data: 2026-06-25
Status: Aceito e implementado

## Contexto

O frontend Angular e o backend Spring Boot se comunicam por HTTP/JSON. A API
precisa identificar o usuário responsável por vendas, caixa, estoque e gestão de
acesso sem manter sessão no servidor.

## Decisão

Usar JWT stateless. O login recebe nome de usuário e senha, normaliza o
identificador e devolve token, expiração, dados públicos e perfis. O frontend
envia `Authorization: Bearer <token>` nas chamadas protegidas.

## Consequências

- O backend obtém autoria operacional a partir do usuário autenticado.
- Spring Security aplica `401` e `403` de forma consistente.
- Senhas são protegidas com BCrypt.
- Refresh token, recuperação de senha e revogação centralizada permanecem fora
  do escopo atual.
