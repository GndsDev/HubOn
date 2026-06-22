# Autenticação

## Visão geral

O HubOn usa JWT no MVP. O login acontece em `/api/auth/login`, o frontend salva a
sessão em `localStorage` e o interceptor envia `Authorization: Bearer <token>`
nas chamadas autenticadas.

Todos os módulos operacionais exigem token válido. Quando o usuário não está
autenticado, o frontend redireciona para `/login` preservando `returnUrl`.

## Sessão

A sessão salva no navegador contém:

- token JWT;
- tipo do token;
- data de expiração;
- dados públicos do usuário autenticado.

Senha nunca é retornada por DTO e nunca é salva no frontend.

## Dados da conta

`GET /api/auth/me` retorna o usuário autenticado atual:

```json
{
  "id": 1,
  "name": "Dono HubOn",
  "email": "owner@hubon.local",
  "active": true,
  "roles": ["OWNER"]
}
```

Esse endpoint é usado pela tela `/minha-conta` para confirmar os dados da sessão.

## Alteração de senha

`PATCH /api/auth/change-password` altera a senha do próprio usuário autenticado.

Payload:

```json
{
  "currentPassword": "senha-atual",
  "newPassword": "NovaSenha123!",
  "confirmPassword": "NovaSenha123!"
}
```

Regras:

- a senha atual deve estar correta;
- a confirmação deve ser igual à nova senha;
- a nova senha deve ser diferente da atual;
- a nova senha deve ter pelo menos 8 caracteres;
- a nova senha deve conter letra, número e caractere especial;
- a senha é salva novamente com BCrypt.

Após sucesso pela interface, o frontend encerra a sessão e redireciona para
`/login` com a mensagem “Senha alterada. Entre novamente.”.

## Permissões

As rotas e endpoints continuam filtrados por perfil:

- `OWNER` e `ADMIN`: gestão, dashboard, cardápio, relatórios e usuários.
- `WAITER`: mesas, comandas e pedidos.
- `KITCHEN`: cozinha e consulta de pedidos permitida.
- `CASHIER`: caixa e comandas.

A interface oculta itens não permitidos, mas a autorização real fica no backend.

## Fora do MVP

- refresh token;
- recuperação de senha;
- bloqueio por tentativas inválidas;
- rotação administrativa de credenciais;
- auditoria completa das ações sensíveis.
