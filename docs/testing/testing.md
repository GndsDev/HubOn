# Testes e automações

## Backend

O backend usa JUnit, Spring Boot Test, Spring Security Test e PostgreSQL real para
integração. A suíte cobre contexto, seed, autenticação por nome de usuário,
autorização, vendas simplificadas, estoque, caixa, relatórios e artefatos PDF/XLSX.

O banco de teste padrão é `hubon_test`. Um guard impede que a suíte de integração
use o banco operacional.

```powershell
cd backend
.\mvnw.cmd clean verify
```

Quando necessário, configure `TEST_DB_URL`, `TEST_DB_USERNAME`,
`TEST_DB_PASSWORD` e `TEST_HUBON_JWT_SECRET` para um PostgreSQL descartável.

## Frontend

O Angular usa Vitest pelo builder de testes. A suíte cobre rotas e guards,
autenticação, temas, Dashboard, Comandas, Balcão, Histórico, Produtos, Estoque,
Caixa, Relatórios, Usuários e componentes compartilhados.

```powershell
cd frontend
npm ci
npm test -- --watch=false
npm run build
```

Os testes priorizam regras observáveis: pesquisa local, escolhas, inclusão e
remoção de itens, quantidade, bloqueio após pagamento, fechamento, vínculos de
estoque, filtros, downloads e acessibilidade de overlays.

## Auditoria visual

Com o frontend em execução:

```powershell
cd frontend
npm run visual:audit
```

`frontend/scripts/visual-audit.mjs` usa `playwright-core` e um navegador instalado
para abrir a aplicação atual com dados controlados, capturar os dois temas e
registrar overflow, heading, erros de execução e cópias incompatíveis. A saída
temporária fica em `frontend/dist/visual-audit`.

Essa automação serve para inspeção visual e geração de screenshots. Ela não é
uma suíte E2E, não valida regras de negócio e não substitui testes unitários,
integração ou homologação manual.

## CI

O workflow da `main` executa:

- backend com Java 21 e PostgreSQL 16;
- testes e build do frontend com Node.js 22;
- validação do Compose e construção das imagens.

## Escopo por mudança

Mudanças somente em documentação exigem validação de links, formatação, termos,
imagens e escopo do diff. Não é necessário executar todas as suítes funcionais
quando nenhum código de aplicação foi alterado.
