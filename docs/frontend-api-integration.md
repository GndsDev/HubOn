# Integração do frontend com a API

## Configuração

- Frontend: `http://localhost:4200`
- API: `http://localhost:8080/api`
- Desenvolvimento e rede local: `frontend/src/environments/environment.development.ts`
- Produção com proxy: `frontend/src/environments/environment.ts`
- HTTP: `provideHttpClient()` em `app.config.ts`
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
- `order-api.service.ts`
- `payment-api.service.ts`
- `dashboard-api.service.ts`
- `user-api.service.ts`
- `operator-context.service.ts`

## Telas integradas

- Dashboard: `/dashboard/summary`
- Categorias: `/categories`
- Produtos: `/products`
- Mesas: `/tables`
- Comandas: `/tabs`
- Pedidos e cozinha: `/orders`
- Caixa: `/payments`
- Usuários: `/users`
- Relatórios: reutiliza `/dashboard/summary`

Não há fallback silencioso para mocks nas telas operacionais. Quando a API está
indisponível, a tela mostra erro e ação para tentar novamente.

## Operador local

- A topbar carrega os usuários ativos por `/users`.
- A escolha é explícita; o primeiro usuário não é selecionado automaticamente.
- O identificador escolhido é salvo em `localStorage` com a chave
  `hubon-operator-id`.
- Mesas/Comandas, Pedidos e Caixa usam esse mesmo operador.
- Sem operador selecionado, abertura de comanda, criação de pedido e pagamento
  são bloqueados antes da chamada à API.

## Atualização periódica

- Dashboard consulta `/dashboard/summary` a cada 30 segundos.
- Cozinha consulta `/orders` a cada 15 segundos.
- As telas usam uma única assinatura com descarte automático ao sair da rota.
- Requisições sobrepostas são ignoradas enquanto a atualização atual não termina.
- O tempo decorrido da cozinha é recalculado junto com cada atualização.

## Estado parcial

- Exportação, cadastro de usuário, impressão parcial e modo chamada aparecem
  desabilitados e identificados como recursos futuros.
- O backend expõe apenas consulta de usuários neste MVP.

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
a passo completo está em [deployment-local.md](deployment-local.md).

O build de produção usa `/api` como URL relativa e pressupõe frontend e backend
atrás do mesmo proxy. Não exponha o perfil local publicamente; consulte
[security-notes.md](security-notes.md).
