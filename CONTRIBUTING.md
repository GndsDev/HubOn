# Guia de contribuição do HubOn

Este documento define a governança oficial de desenvolvimento do HubOn.

O HubOn deixou de ser tratado apenas como um projeto acadêmico e passa a ser conduzido como um produto de software. Isso significa que decisões técnicas, novas funcionalidades e mudanças de escopo devem estar conectadas a problemas reais da operação do cliente.

## Filosofia

O HubOn será desenvolvido como um produto.

Toda funcionalidade deve resolver um problema real do cliente, do operador ou da administração do restaurante.

Nenhuma funcionalidade deve ser implementada apenas por interesse técnico. Experimentos técnicos são bem-vindos quando ajudam a reduzir risco, validar uma decisão ou melhorar a qualidade do produto, mas não devem virar funcionalidade sem justificativa de negócio.

Antes de implementar algo novo, responda:

- Qual problema real isso resolve?
- Quem é afetado por esse problema?
- Como o usuário percebe valor nessa mudança?
- Existe impacto em regras de negócio, banco, API, frontend, testes ou documentação?
- A decisão precisa de um ADR?

## Fluxo oficial de desenvolvimento

O fluxo oficial para novas funcionalidades, mudanças relevantes ou evolução de módulos é:

```text
Ideia
↓
Problema
↓
Discussão
↓
ADR, quando necessário
↓
Arquitetura
↓
Modelagem
↓
Backend
↓
Testes
↓
Frontend
↓
Documentação
↓
Release
↓
Feedback
```

Nem toda mudança pequena precisa passar por todas as etapas formalmente, mas nenhuma implementação relevante deve começar sem clareza de problema, impacto e documentação esperada.

## Fluxo Git

### Branches

Use nomes de branches com prefixos claros:

- `feature/` para novas funcionalidades.
- `fix/` para correções de bug.
- `refactor/` para reorganizações internas sem mudança de comportamento.
- `docs/` para alterações apenas de documentação.
- `hotfix/` para correções urgentes em versão já publicada.

Exemplos:

- `feature/stock-management`
- `fix/order-status-transition`
- `refactor/payment-service`
- `docs/project-governance`
- `hotfix/login-production-config`

### Commits

Use mensagens de commit objetivas, com prefixos padronizados:

- `feat:` nova funcionalidade.
- `fix:` correção de bug.
- `docs:` documentação.
- `refactor:` refatoração sem mudança funcional.
- `test:` criação ou ajuste de testes.
- `perf:` melhoria de performance.
- `build:` build, dependências ou empacotamento.
- `ci:` integração contínua.
- `chore:` manutenção geral.

Exemplos:

- `docs: cria governança oficial do projeto`
- `feat: adiciona fluxo de baixa de estoque`
- `fix: corrige validação de fechamento da comanda`

## Pull Requests

Mesmo quando o desenvolvimento for feito por uma única pessoa, o Pull Request deve funcionar como uma revisão organizada da mudança.

Antes de abrir ou concluir um PR:

- Validar os testes aplicáveis.
- Revisar se a documentação foi atualizada.
- Atualizar changelog quando existir mudança entregue ao usuário.
- Atualizar roadmap quando a mudança alterar planejamento ou escopo.
- Conferir se o `README.md` continua coerente.
- Confirmar que não há segredos, credenciais ou dados sensíveis versionados.
- Confirmar que migrations publicadas não foram alteradas.

Um PR deve explicar:

- Qual problema está sendo resolvido.
- O que foi alterado.
- O que ficou fora do escopo.
- Como a mudança foi validada.
- Quais documentos foram atualizados.

## Regras oficiais

- Nenhuma migration publicada deve ser alterada.
- Nenhum segredo deve ser versionado.
- Nenhuma regra de negócio deve ficar em Controller.
- Nenhum Repository deve conter regra de negócio.
- Toda feature nova deve possuir documentação.
- Toda decisão arquitetural relevante deve possuir ADR.
- Todo módulo novo deve atualizar o roadmap quando necessário.
- Mudanças de backend devem considerar testes automatizados.
- Mudanças de frontend devem considerar fluxo manual e impacto visual.
- Mudanças de banco devem ser feitas apenas por nova migration.

## ADRs

ADR significa Architecture Decision Record.

Use ADR quando uma decisão:

- muda arquitetura;
- altera modelo de dados;
- cria ou remove integrações relevantes;
- define padrão técnico duradouro;
- impacta segurança, permissões ou consistência;
- envolve trade-offs importantes.

O modelo oficial está em [docs/templates/adr-template.md](docs/templates/adr-template.md).

## Documentação

Toda documentação deve permanecer em português, salvo nomes técnicos consagrados.

Ao criar ou alterar funcionalidade, verifique se é necessário atualizar:

- [docs/README.md](docs/README.md), quando surgir novo documento.
- [docs/regras-negocio.md](docs/regras-negocio.md), quando houver regra operacional.
- [docs/endpoints.md](docs/endpoints.md), quando houver API nova ou alterada.
- [docs/database-model.md](docs/database-model.md), quando houver mudança de dados.
- [docs/status-mvp.md](docs/status-mvp.md), quando o status do produto mudar.
- [docs/stock-management.md](docs/stock-management.md), quando envolver Estoque Inteligente.

## Releases

Uma release deve deixar claro:

- versão;
- escopo entregue;
- limitações conhecidas;
- validações realizadas;
- documentação atualizada;
- próximos passos planejados.

Funcionalidade planejada não deve ser descrita como entregue.

