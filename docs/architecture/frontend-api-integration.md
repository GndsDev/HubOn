# Integração do frontend com a API

## Configuração

- Frontend: `http://localhost:4200`
- API: `http://localhost:8080/api`
- Desenvolvimento e rede local: `frontend/src/environments/environment.development.ts`
- Produção com proxy: `frontend/src/environments/environment.ts`
- HTTP: `provideHttpClient(withInterceptors([authInterceptor]))` em `app.config.ts`
- Rotas: `provideRouter(routes)` em `app.config.ts`

O backend aceita, por padrão local, `http://localhost:4200` e
`http://127.0.0.1:4200`. Outras origens devem ser informadas explicitamente em
`HUBON_CORS_ALLOWED_ORIGINS`.

## Services

Os acessos estão em `frontend/src/app/core/services/`:

- `category-api.service.ts`
- `product-api.service.ts`
- `table-api.service.ts`
- `tab-api.service.ts`
- `counter-activity.service.ts`
- `order-api.service.ts`
- `payment-api.service.ts`
- `dashboard-api.service.ts`
- `user-api.service.ts`
- `auth.service.ts`

O interceptor em `core/interceptors/auth.interceptor.ts` envia o JWT salvo no
navegador em todas as chamadas autenticadas.

## Telas integradas

- Dashboard: `/dashboard/summary`
- Categorias: `/categories`
- Produtos: `/products`
- Mesas: `/tables`
- Comandas: `/tabs` e componente compartilhado sobre `/payments`
- Pedidos e preparo: `/orders`
- Balcão: `/tabs/counter`, `/tabs/counter/active`, `/tabs/counter/{id}` e consultas de histórico
- Caixa: `/cash-shifts`; pagamentos aparecem apenas como movimentações e links para a origem
- Usuários: `/users`
- Relatórios: `/reports/monthly`
- Minha Conta: `/auth/me` e `/auth/change-password`

Não há fallback silencioso para mocks nas telas operacionais. Quando a API está
indisponível, a tela mostra erro e ação para tentar novamente.

## Autenticação e autoria

- A tela inicial autentica em `/auth/login`.
- A tela `/minha-conta` consulta `/auth/me` para confirmar os dados do usuário autenticado.
- A alteração de senha usa `/auth/change-password` e encerra a sessão após sucesso.
- A sessão é salva em `localStorage` com a chave `hubon-auth-session`.
- O token é enviado como `Authorization: Bearer <token>`.
- Mesas/Comandas, Pedidos e Caixa não enviam mais o usuário responsável como
  fonte principal.
- O backend associa autoria pelo usuário autenticado do JWT.
- Sem sessão válida, as rotas protegidas não carregam e a API retorna `401`.
- Com perfil inadequado, a API retorna `403`.

## Atualização periódica

- Dashboard consulta `/dashboard/summary` a cada 30 segundos.
- Cozinha consulta `/orders` a cada 15 segundos.
- O indicador global do Balcão consulta `/tabs/counter/active` a cada 30 segundos.
- O atendimento aberto consulta seu detalhe a cada 15 segundos para refletir a Cozinha.
- Ações de montagem, pagamento, preparo, entrega e fechamento também solicitam atualização imediata.
- As telas usam uma única assinatura com descarte automático ao sair da rota.
- Requisições sobrepostas são ignoradas enquanto a atualização atual não termina.
- O tempo decorrido da cozinha é recalculado junto com cada atualização.

## Estado parcial

- O Relatório mensal oferece impressão e CSV apenas quando existem dados carregados.
- Cadastro de usuários existe para `OWNER` e `ADMIN`, respeitando as restrições
  de perfil definidas no backend.
- Troca de senha existe para o usuário autenticado, mas recuperação de senha e
  refresh token ficam fora do MVP.

## Execução

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
cd frontend
npm start
```

Para trocar o endereço da API, ajuste o arquivo de ambiente correspondente.

Para execução em rede local, prefira:

```powershell
npm run start:network
```

Essa configuração usa o hostname aberto no navegador e a porta `8080`. O passo
a passo completo está em [deployment-local.md](../deployment/deployment-local.md).

O build de produção usa `/api` como URL relativa e pressupõe frontend e backend
atrás do mesmo proxy. Não exponha o perfil local publicamente; consulte
[security-notes.md](../deployment/security-notes.md).
