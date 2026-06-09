# Integração frontend com a API

## Endereços e configuração

- Frontend: `http://localhost:4200`
- API: `http://localhost:8080/api`
- URL configurada em `frontend/src/environments/environment.ts`
- Cliente HTTP registrado em `frontend/src/app/app.config.ts`
- CORS liberado para `http://localhost:4200`

O backend continua usando Flyway e `spring.jpa.hibernate.ddl-auto=validate`.

## Módulos integrados

- **Dashboard:** indicadores e resumos reais por `/dashboard/summary`.
- **Categorias:** listagem, criação, edição, ativação e desativação.
- **Produtos:** CRUD do MVP, categoria real, busca e status.
- **Mesas:** listagem, filtros, cadastro, edição e abertura/consulta de comanda.
- **Comandas:** abertas, detalhes, abertura, cancelamento e fechamento.
- **Pedidos:** listagem, criação com múltiplos itens, envio e cancelamento.
- **Cozinha:** Kanban alimentado pelos pedidos reais e avanço de status.
- **Caixa:** resumo de pagamento, histórico, registro e fechamento da comanda.

Todos esses módulos possuem estados de carregamento, erro de conexão e
feedback visual por toast. A mensagem padrão de indisponibilidade é:

`Não foi possível conectar à API local. Verifique se o backend está rodando.`

## Módulos parciais

- **Relatórios:** exibe indicadores ilustrativos; exportação informa
  `Funcionalidade em desenvolvimento.`
- **Usuários:** apresenta usuários mockados para composição visual. Gestão,
  autenticação e permissões ficam para a próxima versão.

Os únicos dados mockados permanecem em
`frontend/src/app/shared/data/mock-data.ts` e são identificados na interface.

## Services Angular

Os acessos à API estão em `frontend/src/app/core/services/`:

- `category-api.service.ts`
- `product-api.service.ts`
- `table-api.service.ts`
- `tab-api.service.ts`
- `order-api.service.ts`
- `payment-api.service.ts`
- `dashboard-api.service.ts`
- `user-api.service.ts`

## Execução

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
cd frontend
npm start
```

Para trocar o host da API, altere somente `environment.apiUrl`. Os models
tipados ficam em `frontend/src/app/shared/models/`.
