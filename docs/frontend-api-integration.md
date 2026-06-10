# Integração do frontend com a API

## Configuração

- Frontend: `http://localhost:4200`
- API: `http://localhost:8080/api`
- URL: `frontend/src/environments/environment.ts`
- HTTP: `provideHttpClient()` em `app.config.ts`
- Rotas: `provideRouter(routes)` em `app.config.ts`

O backend libera CORS para `localhost` e `127.0.0.1` em portas locais.

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

## Estado parcial

- O botão de exportação em Relatórios mostra
  `Funcionalidade em desenvolvimento.`
- O botão de novo usuário mostra a mesma mensagem porque o backend expõe apenas
  consulta de usuários neste MVP.
- Impressão parcial e modo de chamada também são avisos explícitos.

## Execução

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
cd frontend
npm start
```

Para trocar o endereço da API, altere somente `environment.apiUrl`.
