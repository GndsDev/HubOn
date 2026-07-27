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
- `stock`
- `role`
- `user`
- `dashboard`
- `auth`
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

Movimentacoes manuais de estoque tambem usam transacao e lock pessimista no
ingrediente antes de alterar `currentStock`. A alteracao de saldo e o registro
em `inventory_movements` ocorrem juntos, preservando o historico auditavel.

Confirmação de pedido bloqueia o pedido e os itens `DIRECT_SALE` em ordem
determinística. Catálogo, escolhas, snapshots, baixa `SALE`, estados por item e
totais da comanda são tratados na mesma transação. Cancelamentos usam a mesma
estratégia para estornos `REVERSAL` idempotentes.

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

### Autenticação e autorização

O módulo `auth` implementa login, geração e validação de JWT.

Fluxo:

```text
POST /api/auth/login
  ↓
AuthService valida senha BCrypt
  ↓
JwtService gera token com usuário e roles
  ↓
JwtAuthenticationFilter autentica requisições seguintes
```

`SecurityConfig` define acesso por módulo com `OWNER`, `ADMIN`, `WAITER`,
`KITCHEN` e `CASHIER`. Endpoints protegidos retornam `401` sem token válido e
`403` quando o perfil não tem permissão.

`AuthenticatedUserProvider` expõe o usuário autenticado para regras de autoria.
Abrir comanda, criar pedido e registrar pagamento usam esse usuário no backend,
sem confiar em ids enviados manualmente pelo frontend.

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
- Estoque
- Relatórios
- Usuários

As páginas são standalone components e carregadas sob demanda.

### Services HTTP

Os serviços em `core/services/` encapsulam o acesso à API. Os componentes não
montam URLs diretamente e trabalham com interfaces TypeScript de
`shared/models/`.

`AuthService` mantém a sessão JWT em `localStorage`, e
`auth.interceptor.ts` adiciona `Authorization: Bearer <token>` às requisições.

### Angular Router

`app.routes.ts` define rotas reais para todas as telas e informa os perfis
permitidos em `data.roles`. `authGuard` bloqueia rotas sem sessão ou com perfil
inadequado. O layout raiz mantém sidebar, topbar, toast global e
`<router-outlet>`. Rotas desconhecidas redirecionam para `/dashboard`.

### Sessão do usuário

O usuário autenticado aparece na topbar. O menu lateral filtra os módulos
visíveis conforme as roles recebidas no login. A segurança real permanece no
backend; o frontend apenas reduz caminhos inválidos.

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
Usuário autenticado
  ↓
Componente Angular
  ↓
Angular service
  ↓
Auth interceptor
  ↓ HTTP/JSON
Controller Spring
  ↓
JWT filter / SecurityConfig
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
- JWT stateless com roles no token.
- CORS restrito às origens configuradas.
- Frontend de produção espera `/api` no mesmo proxy.
- Sem exclusão física de registros operacionais importantes.

## Catálogo, pedidos e estoque

Os módulos `product`, `order` e `stock` preservam a estrutura
`controller/dto/domain/repository/service`. Controllers apenas validam o
contrato HTTP; services controlam transações, regras e conversão para DTO.

```text
Product -> ProductVariant -> ProductOptionGroup/ProductOption
                              ↓
RestaurantOrder -> OrderItem -> OrderItemOption snapshots
                              ↓ confirmação
ProductStockLink -> Ingredient -> InventoryMovement
```

`Product` não tem preço. `ProductVariant` é a unidade vendável e pode ter um
vínculo ativo com estoque. `OrderItem` congela nomes, categoria, fluxo, preço e
escolhas. O endpoint de fila consulta somente itens de preparo no repositório;
itens de entrega direta não são filtrados apenas no navegador.

O estoque híbrido mantém itens `MANUAL` e `DIRECT_SALE`. A baixa automática
acontece na confirmação, com lock pessimista, `SALE` e restrição única. O
cancelamento gera `REVERSAL` sem apagar o movimento original.

No frontend, `/produtos` oferece cadastro em três etapas, `/pedidos` trabalha
com rascunho e confirmação, `/cozinha` consome a fila específica e `/stock`
concentra operação e auditoria. Menus flutuantes usam cálculo compartilhado de
overlay para evitar clipping.

Detalhes: [product-catalog.md](../business/product-catalog.md),
[order-preparation-flow.md](../business/order-preparation-flow.md) e
[stock-management.md](../business/stock-management.md).
