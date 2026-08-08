# HubOn

Sistema local para gerenciamento da operação de restaurantes, cobrindo o fluxo
completo de atendimento:

**Atendimento → Pedido → Pagamento → Preparo → Entrega → Fechamento**

O projeto foi construído como um MVP funcional e estudável, com frontend e
backend integrados em um monorepo.

## Objetivo

Centralizar a operação diária do estabelecimento sem duplicar responsabilidades.
O Balcão conclui vendas diretas, Comandas concluem vendas de mesa, Pedidos
acompanha a operação e o Caixa controla o turno e o dinheiro.

## Stack

**Backend**

- Java 21
- Spring Boot 4
- Spring Data JPA
- Spring Security
- PostgreSQL
- Flyway
- Maven Wrapper
- Lombok

**Frontend**

- Angular 21
- TypeScript
- Angular Router
- Tailwind CSS
- PrimeIcons
- RxJS

## Funcionalidades do MVP

- Dashboard operacional com atualização periódica.
- Cadastro e ativação de categorias e produtos.
- Gestão de mesas livres, reservadas, ocupadas e desativadas.
- Abertura, consulta, fechamento e cancelamento de comandas.
- Criação de pedidos com snapshots de nome e preço.
- Central persistente de vendas de balcão, com retomada por URL.
- Fluxo de preparo por item acompanhado em Pedidos e Balcão.
- Pagamento parcial ou integral compartilhado entre Balcão e Comandas.
- Início automático do preparo após pagamento integral de vendas `COUNTER`.
- Turno de Caixa com abertura, suprimento, sangria, conferência e fechamento.
- Estoque híbrido, baixa automática, vínculo por variação e estornos.
- Relatório mensal por canal, impressão e exportação CSV.
- Login JWT com roles `OWNER`, `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`.
- Página Minha Conta com dados do usuário autenticado e alteração de senha.
- Autoria das operações pelo usuário autenticado.
- Cadastro de usuários com hierarquia de permissões.
- Relatórios operacionais básicos.
- Temas dark e light.
- Layout responsivo com sidebar recolhível.

## Demonstração visual

### Dashboard

![Dashboard operacional do HubOn](docs/media/screenshots/01-dashboard.png)

O fluxo atual é organizado em Comandas, Balcão, Histórico, Estoque e Caixa,
sem estados de preparo ou uma tela separada de cozinha.

[Assistir à demonstração navegável em WebM](docs/media/videos/hubon-demo.webm)

As dez telas documentadas e as instruções para regenerar as mídias estão em
[portfolio-media.md](docs/portfolio/portfolio-media.md).

## Estrutura do repositório

```text
HubOn/
├── backend/    API Spring Boot, regras de negócio e migrations
├── frontend/   aplicação Angular
└── docs/       documentação funcional e técnica
```

## Pré-requisitos

- Java 21 ou superior compatível com o projeto.
- Node.js e npm.
- PostgreSQL em execução.
- Banco PostgreSQL local configurado.

Configure banco, credenciais seedadas e JWT no arquivo local ignorado
`backend/src/main/resources/application-local.properties` ou por variáveis de
ambiente. Use o modelo seguro
`backend/src/main/resources/application-local.example.properties`.

Exemplo de variáveis principais:

```powershell
$env:DB_URL="jdbc:postgresql://localhost:5432/hubon_db"
$env:DB_USERNAME="hubon_user"
$env:DB_PASSWORD="change-me"
$env:HUBON_JWT_SECRET="use-um-segredo-longo-e-aleatorio"
```

As credenciais dos usuários seedados são definidas por `hubon.seed.owner.*` e
`hubon.seed.admin.*` ou pelas variáveis `HUBON_SEED_OWNER_*` e
`HUBON_SEED_ADMIN_*`. As senhas são gravadas com BCrypt.

## Como executar

### Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

A API fica disponível em `http://localhost:8080/api`.

### Frontend

Em outro terminal:

```powershell
cd frontend
npm install
npm start
```

A interface fica disponível em `http://localhost:4200`.

Para acesso por outro computador da rede:

```powershell
npm run start:network
```

Consulte [deployment-local.md](docs/deployment/deployment-local.md) antes de liberar portas
ou configurar o CORS.

## Como testar

Backend:

Crie uma vez o banco exclusivo de testes:

```sql
CREATE DATABASE hubon_test OWNER hubon_user;
```

Configure as credenciais no terminal quando forem diferentes dos valores do
perfil `test`:

```powershell
$env:TEST_DB_URL="jdbc:postgresql://localhost:5432/hubon_test"
$env:TEST_DB_USERNAME="hubon_user"
$env:TEST_DB_PASSWORD="change-me"
$env:TEST_HUBON_JWT_SECRET="use-um-segredo-longo-exclusivo-para-testes"
```

```powershell
cd backend
.\mvnw.cmd clean verify
```

As suítes Spring usam `application-test.properties` e interrompem a criação do
contexto, antes do Flyway, se `current_database()` não identificar um banco
terminado em `_test` ou `-test`.

Frontend:

```powershell
cd frontend
npm test
npm run build
npm run visual:audit
```

Para validar o produto manualmente, siga
[manual-test-flow.md](docs/testing/manual-test-flow.md). O roteiro cobre a jornada de
uma mesa livre até o fechamento da comanda e sua volta ao estado Livre.

## Status atual

O fluxo operacional principal está funcional e integrado à API. As regras
financeiras críticas, transições operacionais, consistência de mesas e regras de
segurança por perfil possuem testes no backend. O frontend possui build validado
e rotas protegidas por perfil.

Este projeto ainda é um MVP para uso local ou em rede privada confiável. Já há
JWT, autorização por perfil e troca de senha, mas ainda não há refresh token,
recuperação de senha, auditoria completa nem hardening para internet pública.

Consulte [status-mvp.md](docs/status-mvp.md) para o detalhamento completo.

## Fora do MVP

- Delivery e integrações com marketplaces.
- WhatsApp e QR Code.
- Nota fiscal e integração com maquininha.
- Ficha técnica completa por receita, compras e fornecedores.
- Aplicativo mobile.
- Multiempresa e multiunidade.
- WebSocket.
- Integração fiscal e conciliação com adquirentes.

## Roadmap pós-MVP

O roadmap oficial do produto está em [ROADMAP.md](docs/product/ROADMAP.md).

1. Evoluir o estoque híbrido com receitas, compras e fornecedores.
2. Adicionar refresh token, recuperação de senha e política de tentativas.
3. Isolar ambientes de teste com banco dedicado.
4. Ampliar testes do frontend e adicionar testes end-to-end.
5. Criar paginação navegável e filtros por período.
6. Adicionar observabilidade, auditoria e estratégia de backup.
7. Preparar implantação segura com TLS, proxy reverso e gestão de segredos.

## Governança

O HubOn passa a ser tratado como produto de software. Mudanças novas devem partir de problema real, documentação clara e decisões registradas quando necessário.

- [CONTRIBUTING](CONTRIBUTING.md) — guia oficial de desenvolvimento, fluxo Git, PRs e regras do projeto.
- [Product Vision](docs/product/PRODUCT_VISION.md) — visão geral do produto e contexto de uso.
- [Roadmap](docs/product/ROADMAP.md) — direção pós-MVP e próximas prioridades planejadas.
- [Standards](docs/STANDARDS.md) — regras oficiais para evolução do projeto.
- [Glossary](docs/GLOSSARY.md) — glossário oficial de termos de produto, negócio e tecnologia.
- [Templates](docs/README.md#templates) — modelos para módulos, features, APIs e ADRs.
- [ADR](docs/adr/README.md) — índice de decisões arquiteturais relevantes.

## Documentação

| Área | Documento |
| --- | --- |
| Índice geral | [docs/README.md](docs/README.md) |
| Contribuição | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Product Vision | [docs/product/PRODUCT_VISION.md](docs/product/PRODUCT_VISION.md) |
| Roadmap | [docs/product/ROADMAP.md](docs/product/ROADMAP.md) |
| Changelog | [docs/product/CHANGELOG.md](docs/product/CHANGELOG.md) |
| Decisions | [docs/product/DECISIONS.md](docs/product/DECISIONS.md) |
| Standards | [docs/STANDARDS.md](docs/STANDARDS.md) |
| Glossary | [docs/GLOSSARY.md](docs/GLOSSARY.md) |
| Architecture | [docs/architecture/architecture.md](docs/architecture/architecture.md) |
| Business Rules | [docs/business/regras-negocio.md](docs/business/regras-negocio.md) |
| Database | [docs/database/database-model.md](docs/database/database-model.md) |
| API | [docs/api/endpoints.md](docs/api/endpoints.md) |
| Deployment | [docs/deployment/deployment-local.md](docs/deployment/deployment-local.md) |
| Testing | [docs/testing/testing.md](docs/testing/testing.md) |
| Portfolio | [docs/portfolio/portfolio-media.md](docs/portfolio/portfolio-media.md) |
| ADR | [docs/adr/README.md](docs/adr/README.md) |
| Templates | [docs/templates/](docs/templates/) |
