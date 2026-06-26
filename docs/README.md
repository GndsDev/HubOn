# Documentação do HubOn

Este índice organiza a documentação oficial do HubOn por assunto.

O objetivo é facilitar evolução do produto, revisão de decisões e entrada de novos colaboradores sem depender de conhecimento informal espalhado pelo projeto.

## Produto

- [Product Vision](product/PRODUCT_VISION.md): visão do produto, contexto e proposta do HubOn.
- [Roadmap](product/ROADMAP.md): fases planejadas do produto.
- [Changelog](product/CHANGELOG.md): histórico de mudanças documentadas.
- [Decisions](product/DECISIONS.md): guia narrativo para decisões relevantes e ADRs.
- [Status do MVP](status-mvp.md): o que está funcional, parcial, fora do MVP e planejado.
- [Estoque Inteligente](business/stock-management.md): planejamento do módulo de estoque, decisões iniciais e pontos em aberto.
- [Fluxo do sistema](architecture/fluxo-sistema.md): jornada principal entre mesa, comanda, pedido, cozinha e pagamento.

## Arquitetura

- [Arquitetura](architecture/architecture.md): organização do monorepo, camadas, backend, frontend e decisões do MVP.
- [Autenticação](architecture/authentication.md): sessão, permissões e dados da conta.
- [Integração frontend/API](architecture/frontend-api-integration.md): padrão de comunicação entre Angular e API.
- [Roteamento do frontend](architecture/frontend-routing.md): rotas, layout e comportamento esperado.
- [Temas do frontend](architecture/frontend-theme.md): funcionamento dos temas dark e light.

## Negócio

- [Regras de negócio](business/regras-negocio.md): regras operacionais do MVP.
- [Estoque Inteligente](business/stock-management.md): regras planejadas de insumos, receitas e baixa automática.
- [Glossário](GLOSSARY.md): termos oficiais usados no produto e na documentação.

## Banco

- [Modelo de dados](database/database-model.md): tabelas, relacionamentos e evolução planejada.
- [DER e entidades](database/02-der-entidades.md): visão de entidades e relacionamentos.
- [Modelo de banco](database/03-database-model.md): documentação complementar do banco.
- [Schema inicial de referência](database/V1__create_initial_schema.sql): cópia documental do schema inicial.

## API

- [Endpoints](api/endpoints.md): endpoints documentados do MVP.
- [Template de API](templates/api-template.md): modelo para documentação futura de endpoints.

## Deploy

- [Execução local e em rede](deployment/deployment-local.md): instruções de execução local, rede e CORS.
- [Configuração segura](deployment/configuration.md): variáveis, arquivos locais e boas práticas.
- [Notas de segurança](deployment/security-notes.md): limites atuais, permissões e recomendações.
- [Checklist de release](deployment/release-checklist.md): verificação antes de entrega ou demonstração.

## Testes

- [Testes](testing/testing.md): estratégia de testes, cobertura atual e recomendações.
- [Fluxo de teste manual](testing/manual-test-flow.md): roteiro manual da operação principal.

## Portfolio

- [Mídias do portfólio](portfolio/portfolio-media.md): screenshots, vídeo demo e instruções de geração.
- [Identidade visual](portfolio/branding.md): assets oficiais, referências e convenções visuais.

## Templates

- [Template de ADR](templates/adr-template.md): modelo para registrar decisões arquiteturais.
- [Template de módulo](templates/module-template.md): modelo para documentar novos módulos.
- [Template de feature](templates/feature-template.md): modelo para funcionalidades menores.
- [Template de API](templates/api-template.md): modelo para endpoints.

## ADR

ADRs devem ser usados para registrar decisões arquiteturais relevantes antes ou durante a implementação.

- [Índice de ADRs](adr/README.md): decisões estruturais registradas.
- [Template oficial de ADR](templates/adr-template.md): modelo para novas decisões.

## Governança

- [Guia de contribuição](../CONTRIBUTING.md): filosofia, fluxo de desenvolvimento, Git, PRs e regras oficiais.
- [Standards](STANDARDS.md): padrões obrigatórios para evolução do projeto.
- [Glossário](GLOSSARY.md): vocabulário comum para produto, negócio e tecnologia.
- [Templates](#templates): modelos oficiais para documentação futura.

