# Roadmap

Data: 2026-06-25
Status: roadmap oficial do produto

## v0.1 MVP

Objetivo: entregar o fluxo operacional principal de um restaurante local.

Funcionalidades:

- Dashboard operacional.
- Categorias e produtos.
- Mesas.
- Comandas.
- Pedidos.
- Cozinha.
- Caixa e pagamentos.
- Login JWT.
- Roles operacionais.
- Minha Conta e troca de senha.
- Relatorios basicos.
- Temas dark e light.

Status: implementado como MVP.

Dependencias:

- Backend Spring Boot.
- Frontend Angular.
- PostgreSQL.
- Flyway.
- Configuracao local segura.

## v0.2 Segurança

Objetivo: elevar a seguranca para uma base mais proxima de uso real.

Funcionalidades:

- Refresh token ou estrategia equivalente.
- Recuperacao de senha.
- Politica de tentativas de login.
- Auditoria de acoes sensiveis.
- Rotacao administrativa de credenciais.
- Revisao de CORS, headers e armazenamento de token.

Status: planejado.

Dependencias:

- Autenticacao JWT atual.
- Hierarquia de roles.
- Documentacao de seguranca.
- Testes de autorizacao por endpoint.

## v0.3 Operação

Objetivo: melhorar a rotina diaria do salao, cozinha e caixa.

Funcionalidades:

- Paginacao navegavel.
- Filtros por periodo e status.
- Melhorias de busca.
- Estados operacionais mais claros.
- Edicao administrativa de usuarios.
- Auditoria operacional inicial.
- Refinamento do checklist de release.

Status: planejado.

Dependencias:

- MVP estabilizado.
- Regras de negocio documentadas.
- Testes de regressao para fluxos principais.

## v0.4 Estoque Inteligente

Objetivo: criar controle de estoque por insumos, receitas e consumo real.

Funcionalidades:

- Cadastro de insumos.
- Unidades base.
- Movimentacoes de estoque em ledger.
- Receitas/fichas tecnicas.
- Baixa automatica por pedido.
- Estorno em cancelamentos elegiveis.
- Cache documentado de quantidade atual.

Status: planejado.

Dependencias:

- ADR-0004 Inventory Ledger.
- ADR-0005 Inventory Consumption Lifecycle.
- ADR-0006 CurrentQuantity Cache.
- Modelo de dados aprovado.
- Regras de estoque documentadas.

## v0.5 Gestão Financeira

Objetivo: ampliar o controle financeiro da operacao.

Funcionalidades:

- Fechamento de caixa.
- Relatorios por periodo.
- Separacao por metodo de pagamento.
- Exportacao de relatorios.
- Indicadores de ticket medio, faturamento e pagamentos.

Status: planejado.

Dependencias:

- Pagamentos do MVP.
- Filtros por periodo.
- Auditoria operacional.

## v0.6 Inteligência Operacional

Objetivo: transformar dados operacionais em apoio a decisao.

Funcionalidades:

- Indicadores de tempo de preparo.
- Gargalos de cozinha.
- Produtos mais vendidos.
- Alertas operacionais.
- Comparativos por periodo.
- Base para previsao de demanda.

Status: planejado.

Dependencias:

- Historico operacional consistente.
- Relatorios financeiros.
- Dados de estoque quando aplicavel.

## v0.7 Compras

Objetivo: apoiar reposicao de estoque e relacionamento com fornecedores.

Funcionalidades:

- Cadastro de fornecedores.
- Sugestao de compra.
- Registro de compras.
- Custo de insumos.
- Entrada de estoque por compra.
- Alertas de reposicao.

Status: planejado.

Dependencias:

- Estoque Inteligente.
- Ledger de estoque.
- Cadastro de insumos.
- Politica de custos.

## v0.8 Dashboard Executivo

Objetivo: oferecer visao gerencial consolidada para proprietarios e gestores.

Funcionalidades:

- Indicadores financeiros.
- Indicadores de operacao.
- Indicadores de estoque.
- Comparativos por periodo.
- Cards executivos.
- Drill-down para detalhes operacionais.

Status: planejado.

Dependencias:

- Gestao Financeira.
- Inteligencia Operacional.
- Compras.
- Dados historicos suficientes.

## v0.9 Release Candidate

Objetivo: estabilizar a primeira versao comercial.

Funcionalidades:

- Revisao completa de documentacao.
- Testes de regressao.
- Checklist de seguranca.
- Checklist de release.
- Ajustes de usabilidade.
- Revisao de performance.
- Plano de backup e restauracao.

Status: planejado.

Dependencias:

- Escopo v1.0 congelado.
- Testes automatizados e manuais atualizados.
- ADRs revisados.
- CHANGELOG atualizado.

## v1.0 Primeira versão comercial

Objetivo: entregar a primeira versao comercial do HubOn.

Funcionalidades:

- Fluxo operacional estavel.
- Autenticacao e autorizacao endurecidas.
- Documentacao completa.
- Processo de release versionado.
- Instalacao e configuracao documentadas.
- Suporte inicial a operacao real conforme escopo aprovado.

Status: planejado.

Dependencias:

- v0.9 validada.
- Pendencias criticas resolvidas.
- Testes antes de merge.
- Release notes publicadas.
