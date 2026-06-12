# Arquitetura do HubOn

## Monorepo

O HubOn mantém backend, frontend e documentação no mesmo repositório:

```text
HubOn/
├── backend/
│   └── src/main/java/com/hubon/backend/
├── frontend/
│   └── src/app/
└── docs/
```

Essa organização facilita a evolução conjunta do contrato HTTP, das regras de
negócio e da interface.

## Backend

O backend é uma API Spring Boot organizada por módulos de domínio:

```text
module/
├── controller/
├── dto/
├── domain/
├── repository/
└── service/
```

Módulos principais:

- `category`
- `product`
- `table`
- `tab`
- `order`
- `payment`
- `role`
- `user`
- `dashboard`
- `shared`

### Fluxo em camadas

```text
Controller → Service → Repository → PostgreSQL
```

**Controller**

- Expõe os endpoints REST.
- Recebe e valida DTOs de entrada.
- Não contém regras de negócio.
- Retorna DTOs, nunca entidades JPA diretamente.

**Service**

- Executa regras de negócio e transações.
- Coordena múltiplos repositories.
- Controla transições de estados e cálculos.
- Converte entidades em DTOs de resposta.

**Repository**

- Usa Spring Data JPA.
- Centraliza consultas, agregações e locks.
- Evita SQL manual na camada web.

**Domain**

- Contém entidades JPA e enums.
- Mapeia o modelo persistido pelo Flyway.

### DTOs

Requests e responses são separados das entidades para:

- não expor detalhes internos de persistência;
- controlar campos aceitos pela API;
- aplicar validações;
- manter o contrato HTTP mais estável.

### Transações e concorrência

Operações que alteram comandas usam transações. Pagamento, criação de pedido e
fechamento obtêm a comanda com lock pessimista quando precisam proteger os
totais. Isso serializa alterações concorrentes e impede que pagamentos
simultâneos ultrapassem o valor final.

### Persistência e migrations

O esquema é controlado pelo Flyway em:

```text
backend/src/main/resources/db/migration/
```

A propriedade obrigatória é:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

O Hibernate valida o mapeamento, mas não cria nem atualiza tabelas. Alterações de
esquema devem entrar em uma nova migration; migrations existentes não devem ser
reescritas depois de aplicadas.

`spring.jpa.open-in-view=false` mantém o acesso ao banco restrito às camadas
transacionais.

### Erros

`GlobalExceptionHandler` converte falhas para JSON:

```json
{
  "message": "Descrição do erro",
  "status": 400,
  "timestamp": "2026-06-12T10:00:00"
}
```

São tratados recursos não encontrados, regras de negócio, validação, integridade,
concorrência pessimista e falhas inesperadas.

## Frontend

O frontend Angular é organizado por responsabilidade:

```text
src/app/
├── core/services/
├── features/
├── shared/components/
├── shared/directives/
├── shared/models/
└── shared/util/
```

### Features

Cada tela operacional fica em `features/`:

- Dashboard
- Mesas
- Comandas
- Pedidos
- Cozinha
- Caixa
- Categorias
- Produtos
- Relatórios
- Usuários

As páginas são standalone components e carregadas sob demanda.

### Services HTTP

Os serviços em `core/services/` encapsulam o acesso à API. Os componentes não
montam URLs diretamente e trabalham com interfaces TypeScript de
`shared/models/`.

### Angular Router

`app.routes.ts` define rotas reais para todas as telas. O layout raiz mantém a
sidebar, topbar, toast global e `<router-outlet>`. Rotas desconhecidas
redirecionam para `/dashboard`.

### OperatorContextService

O serviço:

- carrega usuários ativos pela API;
- exige seleção explícita do operador;
- persiste o identificador em `localStorage`;
- fornece o operador para abertura de comanda, pedido e pagamento.

Esse contexto registra autoria local, mas não autentica o usuário.

### ThemeService

O tema `dark` ou `light` é armazenado em `localStorage`. O serviço aplica
`data-theme` no elemento `<html>`, e o CSS global usa variáveis para adaptar
superfícies, textos e bordas.

### Componentes compartilhados

Componentes de cabeçalho, cards, badges, estados vazios e toast mantêm
consistência visual. A diretiva de diálogo adiciona foco inicial, restauração de
foco e fechamento por `Escape`.

## Fluxo completo

```text
Usuário
  ↓
Componente Angular
  ↓
Angular service
  ↓ HTTP/JSON
Controller Spring
  ↓
Service de domínio
  ↓
Repository JPA
  ↓
PostgreSQL
```

A resposta percorre o caminho inverso como DTO JSON e atualiza os signals/estado
da tela.

## Decisões do MVP

- REST síncrono, sem WebSocket.
- Polling controlado no Dashboard e Cozinha.
- Operador local sem login.
- CORS restrito às origens configuradas.
- Frontend de produção espera `/api` no mesmo proxy.
- Sem exclusão física de registros operacionais importantes.

