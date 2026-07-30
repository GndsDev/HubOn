# Testes do HubOn

## Visão geral

O projeto combina três níveis de validação:

1. Testes automatizados de integração no backend.
2. Testes unitários e de componente no frontend.
3. Build de produção e roteiro manual do fluxo operacional.

Os testes de integração do backend usam o perfil `test` e um PostgreSQL
exclusivo. Eles não usam `application-local.properties` nem o banco de
desenvolvimento.

## Backend

Crie o banco uma vez com um usuário autorizado:

```sql
CREATE DATABASE hubon_test OWNER hubon_user;
```

Configure as variáveis quando as credenciais locais forem diferentes dos
valores padrão de `application-test.properties`:

```powershell
$env:TEST_DB_URL="jdbc:postgresql://localhost:5432/hubon_test"
$env:TEST_DB_USERNAME="hubon_user"
$env:TEST_DB_PASSWORD="change-me"
$env:TEST_HUBON_JWT_SECRET="use-um-segredo-longo-exclusivo-para-testes"
```

Na pasta `backend`:

```powershell
.\mvnw.cmd clean verify
```

O comando compila a aplicação, inicializa o contexto Spring, valida a migration
Flyway e executa as suítes JUnit.

### Cobertura atual

`BackendApplicationTests`

- Inicialização do contexto Spring.
- Carregamento das configurações, repositories e entidades.

`FinancialRulesIntegrationTests`

- Pagamento válido.
- Rejeição de pagamento zero.
- Rejeição de pagamento acima do saldo.
- Proteção contra pagamentos simultâneos que excedam a comanda.
- Bloqueio de cancelamento de pedido após pagamento.
- Bloqueio de cancelamento de pedido entregue.
- Exclusão de pedido cancelado dos totais.
- Bloqueio de cancelamento de comanda com pagamento.
- Bloqueio de cancelamento de comanda com pedido entregue.
- Rejeição de fechamento com pagamento incompleto ou excedente.
- Fechamento com pagamento exato e liberação da mesa.

`OperationalConsistencyIntegrationTests`

- Bloqueio de `OCCUPIED` em cadastro e edição manual de mesa.
- Bloqueio de abertura de comanda em mesa reservada.
- Controle do estado ocupado pelo ciclo da comanda.
- Bloqueio de venda de produto pertencente a categoria inativa.
- Limite de cinco pedidos recentes no Dashboard.

`SecurityAuthorizationIntegrationTests`

- `401` para endpoint protegido sem token.
- `403` para token válido com perfil inadequado.
- `KITCHEN` acessa somente a fila e a transição do item de preparo.
- `KITCHEN` recebe `403` ao listar pedidos, acessar estoque ou criar, confirmar,
  cancelar e alterar globalmente um pedido.
- Itens `DIRECT_SERVICE` não aceitam transições da cozinha.
- `OWNER` e `ADMIN` preservam seus acessos administrativos.
- Login inválido rejeitado.
- Consulta de `/api/auth/me` exige autenticação e não expõe senha.
- Alteração de senha exige autenticação.
- Alteração de senha rejeita senha atual inválida.
- Alteração de senha rejeita confirmação divergente.
- Alteração de senha rejeita senha igual à atual.
- Alteração de senha rejeita senha fraca.
- Alteração de senha válida salva hash BCrypt e invalida a senha antiga.
- `OWNER` cria `ADMIN` e perfis operacionais, mas não cria outro `OWNER`.
- `ADMIN` cria somente perfis operacionais.
- Usuário operacional não cria usuários.

`DataSeederIntegrationTests`

- Criação de usuários seedados a partir de `hubon.seed.owner.*` e
  `hubon.seed.admin.*`.
- Senhas seedadas gravadas com BCrypt, nunca em texto puro.
- Login funcionando com a senha configurada no ambiente de teste.
- Fluxos explícitos para suco, refrigerante e prato executivo.
- Variação Padrão e preço mantidos em `product_variants`.
- Nova execução do seeder não duplica catálogo, usuários, variações ou mesas.

`LegacyDirectServiceMigrationIntegrationTests`

- Itens legados `DIRECT_SERVICE` presos em preparo são corrigidos para `READY`.
- Pedido somente direto é liberado quando não restam itens pendentes.
- Pedido misto continua em preparo enquanto houver item da cozinha pendente.
- Itens e pedidos cancelados ou entregues permanecem inalterados.
- Flyway registra a migration V6 como aplicada.

### Dependência do banco

Todas as classes com `@SpringBootTest` ativam `@ActiveProfiles("test")`. O guard
`IntegrationTestDatabaseGuard` consulta `select current_database()` durante a
inicialização, antes do Flyway, e aceita somente nomes terminados em `_test` ou
`-test`. Uma configuração apontando para `hubon_db`, produção ou qualquer outro
banco encerra o contexto com uma mensagem indicando `TEST_DB_URL`.

## Frontend

Instale as dependências antes da primeira execução:

```powershell
npm install
```

Para executar os testes uma vez:

```powershell
npm test -- --watch=false
```

Para validar tipos dos specs sem abrir o runner:

```powershell
npx tsc -p tsconfig.spec.json --noEmit
```

Para manter o runner observando mudanças:

```powershell
npm test
```

### Cobertura atual

`app.spec.ts`

- Criação do componente raiz.
- Renderização da tela de login quando não há sessão.
- Redirecionamento de rota protegida para login com `returnUrl`.
- Redirecionamento de rota desconhecida.
- Acesso autenticado à rota `/minha-conta`.

`auth.service.spec.ts`

- Consulta de `/auth/me` e atualização do usuário salvo na sessão.
- Envio do payload de alteração de senha para `/auth/change-password`.

`account-page.component.spec.ts`

- Renderização dos dados do usuário autenticado.
- Alteração de senha com logout e redirecionamento para `/login`.

O build garante que interceptor, guards de rotas e templates compilam.

Em ambientes de sandbox muito restritivos, o runner Angular pode falhar ao
resolver arquivos locais com mensagens de acesso negado. Nesse caso, valide em
um terminal normal do Windows, rode `npx tsc -p tsconfig.spec.json --noEmit`
para checar tipos dos specs e use o build como verificação adicional.

## Build do frontend

Na pasta `frontend`:

```powershell
npm run build
```

O build deve terminar sem erros e gerar os artefatos em `frontend/dist/`.

Scripts disponíveis:

| Comando | Finalidade |
| --- | --- |
| `npm start` | Servidor de desenvolvimento em localhost. |
| `npm run start:network` | Servidor acessível pela rede local. |
| `npm run build` | Build otimizado de produção. |
| `npm run watch` | Build de desenvolvimento em modo observação. |
| `npm test` | Testes Angular em modo observação. |

## Automação de mídia

Com backend e frontend rodando, configure um usuário `OWNER` ou `ADMIN` somente
no terminal:

```powershell
$env:HUBON_PORTFOLIO_EMAIL="owner@hubon.local"
$env:HUBON_PORTFOLIO_PASSWORD="senha-local-nao-versionada"
```

Depois, na pasta `frontend`:

```powershell
npm run portfolio:screenshots
npm run portfolio:video
```

O script autentica em `/api/auth/login`, grava a sessão no `localStorage` com a
mesma chave do frontend e envia `Authorization: Bearer <token>` nas chamadas
diretas à API. Não salve `HUBON_PORTFOLIO_PASSWORD` em arquivo versionado.

## Como interpretar falhas

- **Falha de conexão com PostgreSQL:** verifique serviço, banco, usuário, senha e
  variáveis `TEST_DB_URL`, `TEST_DB_USERNAME` e `TEST_DB_PASSWORD`.
- **Falha do Flyway:** confira se o banco não possui alteração manual conflitante
  com as migrations.
- **Falha de regra de negócio:** leia o nome do teste e a mensagem esperada; não
  ajuste o teste antes de confirmar a regra em
  [regras-negocio.md](../business/regras-negocio.md).
- **Falha de contexto Spring:** procure primeiro por propriedades ausentes,
  consultas inválidas ou mapeamentos JPA incompatíveis.
- **Falha de TypeScript/template:** execute `npm run build` para obter o arquivo e
  a linha envolvidos.
- **Falha no login local:** confirme se o usuário seedado foi criado com as
  propriedades `hubon.seed.owner.*` ou `hubon.seed.admin.*` e se a senha foi
  configurada antes da primeira criação desse usuário no banco.
- **Falha de teste visual ou de rota:** confirme se o mock do serviço e a rota
  usada pelo teste ainda correspondem à aplicação.

## Teste manual

Depois dos testes automatizados, execute o roteiro em
[manual-test-flow.md](manual-test-flow.md). Ele valida a integração real entre
Angular, API e PostgreSQL.

Valide também permissões por perfil:

- Deslogado: abrir `http://localhost:4200` e confirmar redirecionamento para
  `/login`.
- `OWNER`: acessar Dashboard, Usuários, Categorias e Produtos.
- `WAITER`: acessar Mesas e Pedidos, mas não Usuários, Categorias ou Produtos.
- `ADMIN`: confirmar que não consegue criar `OWNER` nem outro `ADMIN`.
- `KITCHEN`: acessar apenas o fluxo permitido de Cozinha.
- `CASHIER`: acessar Caixa e Comandas conforme a regra.
- Logout: confirmar retorno ao login.

## Testes recomendados para a próxima versão

- Banco PostgreSQL descartável com Testcontainers.
- Testes HTTP dos controllers e do formato de erros.
- Testes unitários para cálculos de comanda.
- Testes de acessibilidade dos modais e navegação por teclado.
- Testes de componentes para Mesas, Cozinha e Caixa.
- Testes end-to-end do fluxo completo.
- Testes de CORS e perfis `local`/`prod`.
- Testes de carga para pedidos, Dashboard e pagamentos concorrentes.
- Quando o Estoque Inteligente for implementado: conversão de unidades,
  movimentações atômicas, venda com saldo negativo e alerta, capacidade de
  produção, concorrência de baixas e estornos idempotentes. O planejamento do
  módulo está em [stock-management.md](../business/stock-management.md).

## Balcão, relatório e overlays

`CounterSalesAndMonthlyReportsIntegrationTests` cobre comanda sem mesa, rascunho vazio ou com itens, retomada em nova requisição, venda direta, preparada e mista, estoque idempotente, pagamento parcial e total, pagamento antes do preparo, atualização da cozinha, entrega, finalização, histórico, cancelamento, estorno e agregações mensais. `SecurityAuthorizationIntegrationTests` cobre 401/403, acesso por URL direta e os perfis dos endpoints. Todo teste de integração mantém `IntegrationTestDatabaseGuard` e o perfil `test`, apontado exclusivamente para `hubon_test`.

No frontend, as suítes de `counter-page`, `counter-activity`, `counter-workflow`, `monthly-report-csv`, `overlay-stack` e `accessible-dialog` cobrem criação persistente, retomada pela URL, edição do rascunho, pagamento parcial, preparo após pagamento, entrega e finalização separadas, histórico, indicador global, próxima ação contextual, exportação, raiz única de overlay, ESC, foco, Tab/Shift+Tab e restauração de foco. Os cenários de viewport e temas permanecem na auditoria visual automatizada.
