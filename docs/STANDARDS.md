# Standards

Data: 2026-06-25
Status: padrao oficial do projeto

Este documento registra os padroes obrigatorios para evolucao do HubOn.

## Backend

- Controllers nao possuem regra de negocio.
- Services concentram regras.
- Repositories apenas persistem e consultam dados.
- DTOs representam comunicacao.
- Entidades representam dominio.
- Soft delete deve ser usado sempre que necessario para preservar historico.
- Nenhum segredo deve ser hardcoded.
- Nenhuma credencial deve ser versionada.

## Frontend

- Usar Standalone Components.
- Usar Angular Signals quando fizer sentido.
- Usar Guards para autorizacao.
- Usar Interceptors para autenticacao.
- Usar services para comunicacao com API.
- Manter componentes pequenos e reutilizaveis.

## Banco

- Flyway e obrigatorio.
- Nunca alterar migration publicada.
- Tabelas devem ser nomeadas em ingles.
- Entidades Java devem usar singular.
- Tabelas devem usar plural.
- Indices devem ser documentados.

## Git

- Usar Conventional Commits.
- Criar releases versionadas.
- Manter CHANGELOG atualizado.
- Manter README sincronizado.
- Executar testes antes de merge.

## Documentacao

Toda funcionalidade nova deve possuir:

- problema;
- objetivo;
- arquitetura;
- modelo de dados;
- regras de negocio;
- roadmap;
- testes;
- documentacao atualizada.

Documentacao de arquitetura, produto e dominio deve ser atualizada junto com a
mudanca que altera o comportamento planejado ou implementado.
