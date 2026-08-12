# Padrões do projeto

## Backend

- Controllers cuidam de HTTP; Services concentram regras e transações.
- Repositories persistem e consultam, sem orquestrar regras de negócio.
- DTOs definem o contrato externo; entidades representam persistência e domínio.
- Toda ação relevante registra o usuário autenticado quando o modelo exige.
- Segredos e credenciais nunca são escritos no código ou versionados.

## Frontend

- Standalone Components, Signals e serviços tipados.
- Guards orientam navegação; autorização real permanece no backend.
- Interceptor adiciona autenticação.
- Ações pequenas atualizam estado local, sem recarga completa.
- Componentes compartilhados preservam acessibilidade, temas e overlays.
- Não usar `any` ou casts para esconder incompatibilidade de contrato.

## Banco

- Flyway é obrigatório e migrations publicadas são imutáveis.
- Toda mudança de esquema usa uma nova versão.
- Tabelas usam nomes em inglês e plural; entidades Java usam singular.
- Restrições e índices importantes devem ser refletidos na documentação.

## Git e qualidade

- Mensagens seguem Conventional Commits.
- Mudanças preservam trabalho local não relacionado.
- Testes e build aplicáveis são executados antes da entrega.
- Documentação, screenshots e contratos acompanham mudanças de comportamento.
- Pull requests não contêm segredos, artefatos temporários ou dumps.

## Documentação

- Descrever o comportamento implementado, não uma intenção antiga.
- Preferir um documento canônico por assunto.
- Manter links relativos válidos e alt text descritivo.
- Remover documentos superados; o Git preserva o histórico.
- Capturas são revisadas visualmente e usam somente dados fictícios.
