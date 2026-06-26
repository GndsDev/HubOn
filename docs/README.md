# Documentação do HubOn

Este índice organiza a documentação oficial do HubOn por assunto.

O objetivo é facilitar evolução do produto, revisão de decisões e entrada de novos colaboradores sem depender de conhecimento informal espalhado pelo projeto.

## Produto

- [Visão geral](01-visao-geral.md): visão do produto, contexto e proposta do HubOn.
- [Status do MVP](status-mvp.md): o que está funcional, parcial, fora do MVP e planejado.
- [Estoque Inteligente](stock-management.md): planejamento do módulo de estoque, decisões iniciais e pontos em aberto.
- [Fluxo do sistema](fluxo-sistema.md): jornada principal entre mesa, comanda, pedido, cozinha e pagamento.

## Arquitetura

- [Arquitetura](architecture.md): organização do monorepo, camadas, backend, frontend e decisões do MVP.
- [Integração frontend/API](frontend-api-integration.md): padrão de comunicação entre Angular e API.
- [Roteamento do frontend](frontend-routing.md): rotas, layout e comportamento esperado.
- [Temas do frontend](frontend-theme.md): funcionamento dos temas dark e light.

## Negócio

- [Regras de negócio](regras-negocio.md): regras operacionais do MVP.
- [Autenticação](authentication.md): sessão, permissões e dados da conta.
- [Glossário](GLOSSARY.md): termos oficiais usados no produto e na documentação.

## Banco

- [Modelo de dados](database-model.md): tabelas, relacionamentos e evolução planejada.
- [DER e entidades](02-der-entidades.md): visão de entidades e relacionamentos.
- [Modelo de banco](03-database-model.md): documentação complementar do banco.
- [Schema inicial de referência](V1__create_initial_schema.sql): cópia documental do schema inicial.

## API

- [Endpoints](endpoints.md): endpoints documentados do MVP.
- [Template de API](templates/api-template.md): modelo para documentação futura de endpoints.

## Deploy

- [Execução local e em rede](deployment-local.md): instruções de execução local, rede e CORS.
- [Configuração segura](configuration.md): variáveis, arquivos locais e boas práticas.
- [Notas de segurança](security-notes.md): limites atuais, permissões e recomendações.

## Testes

- [Testes](testing.md): estratégia de testes, cobertura atual e recomendações.
- [Fluxo de teste manual](manual-test-flow.md): roteiro manual da operação principal.
- [Checklist de release](release-checklist.md): verificação antes de entrega ou demonstração.

## Portfolio

- [Mídias do portfólio](portfolio-media.md): screenshots, vídeo demo e instruções de geração.
- [Identidade visual](branding.md): assets oficiais, referências e convenções visuais.

## Templates

- [Template de ADR](templates/adr-template.md): modelo para registrar decisões arquiteturais.
- [Template de módulo](templates/module-template.md): modelo para documentar novos módulos.
- [Template de feature](templates/feature-template.md): modelo para funcionalidades menores.
- [Template de API](templates/api-template.md): modelo para endpoints.

## ADR

ADRs devem ser usados para registrar decisões arquiteturais relevantes antes ou durante a implementação.

Enquanto ainda não houver uma pasta dedicada para ADRs aprovados, use o [template oficial de ADR](templates/adr-template.md) como padrão e referencie a decisão nos documentos afetados.

## Governança

- [Guia de contribuição](../CONTRIBUTING.md): filosofia, fluxo de desenvolvimento, Git, PRs e regras oficiais.
- [Glossário](GLOSSARY.md): vocabulário comum para produto, negócio e tecnologia.
- [Templates](#templates): modelos oficiais para documentação futura.

