# Testes do HubOn

## Visão geral

O projeto combina três níveis de validação:

1. Testes automatizados de integração no backend.
2. Testes unitários e de componente no frontend.
3. Build de produção e roteiro manual do fluxo operacional.

Os testes do backend usam o perfil local e acessam PostgreSQL. Antes de
executá-los, confirme que o banco local está disponível e que as credenciais
estão corretas. Configure variáveis de ambiente ou crie
`backend/src/main/resources/application-local.properties` a partir de
`application-local.example.properties`.

## Backend

Na pasta `backend`:

```powershell
.\mvnw.cmd test
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
- Permissões de acesso por módulo para `WAITER` e `KITCHEN`.
- Login inválido rejeitado.
- `OWNER` cria `ADMIN` e perfis operacionais, mas não cria outro `OWNER`.
- `ADMIN` cria somente perfis operacionais.
- Usuário operacional não cria usuários.

`DataSeederIntegrationTests`

- Criação de usuários seedados a partir de `hubon.seed.owner.*` e
  `hubon.seed.admin.*`.
- Senhas seedadas gravadas com BCrypt, nunca em texto puro.
- Login funcionando com a senha configurada no ambiente de teste.

### Dependência do banco

As suítes de integração criam dados próprios e os removem ao final, mas usam o
banco configurado para o perfil local. Para maior isolamento, a próxima versão
deve adotar um banco exclusivo de testes ou containers descartáveis.

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
- Redirecionamento de rota desconhecida.

Autenticação e rotas protegidas ainda devem receber testes específicos no
frontend na próxima versão. O build garante que o interceptor, guarda de rotas e
templates compilam.

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

## Como interpretar falhas

- **Falha de conexão com PostgreSQL:** verifique serviço, banco, usuário, senha e
  variáveis `DB_URL`, `DB_USERNAME` e `DB_PASSWORD`.
- **Falha do Flyway:** confira se o banco não possui alteração manual conflitante
  com as migrations.
- **Falha de regra de negócio:** leia o nome do teste e a mensagem esperada; não
  ajuste o teste antes de confirmar a regra em `regras-negocio.md`.
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

## Testes recomendados para a próxima versão

- Banco PostgreSQL descartável com Testcontainers.
- Testes HTTP dos controllers e do formato de erros.
- Testes unitários para cálculos de comanda.
- Testes de acessibilidade dos modais e navegação por teclado.
- Testes de componentes para Mesas, Cozinha e Caixa.
- Testes end-to-end do fluxo completo.
- Testes de CORS e perfis `local`/`prod`.
- Testes de carga para pedidos, Dashboard e pagamentos concorrentes.
