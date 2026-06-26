# Product Vision

Data: 2026-06-25
Status: documento oficial do produto

Este documento e a constituicao do HubOn. Ele orienta prioridades, arquitetura,
documentacao e decisoes de implementacao futuras.

## Visao do produto

O HubOn e um sistema de gestao operacional para restaurantes, lanchonetes,
trailers e pequenos negocios de alimentacao que precisam controlar atendimento,
cozinha, caixa e evolucao de estoque em uma unica plataforma.

O produto nasce como uma solucao local e objetiva, mas deve evoluir para um
software comercial confiavel, simples de operar e seguro para ambientes reais.

## Missao

Reduzir a desorganizacao operacional de negocios de alimentacao, ajudando equipes
a registrar pedidos, acompanhar producao, controlar pagamentos e tomar decisoes
com dados claros.

## Visao de longo prazo

O HubOn deve se tornar uma plataforma de operacao e inteligencia para pequenos e
medios negocios de alimentacao, cobrindo:

- atendimento no salao;
- producao da cozinha;
- caixa e fechamento financeiro;
- estoque por insumos, receitas e consumo real;
- compras e fornecedores;
- indicadores executivos;
- auditoria operacional;
- evolucao segura para uso comercial.

## Publico-alvo

- Proprietarios de restaurantes, lanchonetes, trailers e pequenos negocios de
  alimentacao.
- Gerentes responsaveis por operacao, caixa, equipe e estoque.
- Garcons e atendentes que precisam registrar pedidos com rapidez.
- Cozinhas que precisam visualizar fila de producao.
- Operadores de caixa que precisam fechar comandas com seguranca.
- Equipes pequenas que hoje dependem de papel, planilhas ou sistemas parciais.

## Problemas que o HubOn resolve

- Falta de visao clara sobre mesas, comandas e pedidos abertos.
- Erros de comunicacao entre atendimento, cozinha e caixa.
- Perda de historico por controles manuais.
- Pagamentos inconsistentes ou fechamento de comanda sem conferencias.
- Dificuldade para separar responsabilidades por perfil.
- Falta de base estruturada para evoluir estoque, compras e indicadores.

## Filosofia do produto

Toda funcionalidade nova deve responder oficialmente:

1. Qual problema real do cliente ela resolve?
2. Como o cliente faz isso hoje?
3. Como o HubOn faz melhor?

Se uma funcionalidade nao resolve um problema real do cliente, ela nao deve ser
priorizada.

O HubOn deve preferir fluxos simples, verificaveis e uteis no dia a dia a
recursos vistosos que nao melhorem a operacao. Cada tela deve existir para
reduzir erro, acelerar trabalho ou aumentar controle.

## Principios de desenvolvimento

- Documentar antes de implementar funcionalidades relevantes.
- Manter regras de negocio testaveis e centralizadas.
- Evoluir em fases pequenas, com escopo claro.
- Evitar atalhos que dificultem seguranca, auditoria ou manutencao.
- Nao misturar comportamento de produto com detalhes acidentais da interface.
- Validar uma regra no backend mesmo quando a interface ja limita a acao.
- Atualizar README, roadmap, regras, dados, testes e ADRs quando uma decisao
  mudar o produto.

## Principios de arquitetura

- Controllers expõem contratos HTTP e nao possuem regra de negocio.
- Services concentram regras, transacoes e orquestracao.
- Repositories persistem e consultam dados.
- DTOs representam comunicacao entre API e clientes.
- Entidades representam dominio persistido.
- Flyway controla a evolucao do banco.
- Migrations publicadas nao devem ser alteradas.
- Autenticacao e autorizacao devem ser validadas no backend.
- Segredos e credenciais nao podem ser versionados.
- Decisoes estruturais devem ser registradas em ADRs.

## Principios do dominio

- Mesa representa a capacidade operacional do salao.
- Comanda representa o ciclo de consumo de uma mesa.
- Pedido representa a solicitacao do cliente e seu estado de producao.
- Item de pedido preserva snapshot de nome e preco do produto no momento da
  venda.
- Pagamento representa quitacao parcial ou total de uma comanda.
- Estoque futuro deve ser auditavel por movimentacoes, nao por ajuste invisivel.
- Cancelamentos e estornos devem preservar historico.
- Quantidades derivadas podem existir como cache, desde que a fonte de verdade
  esteja documentada.

## Filosofia de documentacao

A documentacao e parte do produto. Ela deve explicar o motivo das decisoes, o
comportamento esperado e os limites atuais.

Toda funcionalidade nova deve possuir:

- problema;
- objetivo;
- arquitetura;
- modelo de dados;
- regras de negocio;
- roadmap;
- testes;
- documentacao atualizada.

Decisoes importantes devem ser registradas em ADRs dentro de `docs/adr/`.

## Roadmap por fases

O roadmap oficial esta em [ROADMAP.md](ROADMAP.md).

- v0.1 MVP: operacao principal de salao, cozinha, caixa e autenticacao.
- v0.2 Segurança: hardening, refresh token, recuperacao de senha e auditoria.
- v0.3 Operação: melhorias de usabilidade, filtros, paginacao e rotina diaria.
- v0.4 Estoque Inteligente: insumos, receitas, ledger e baixa automatica.
- v0.5 Gestão Financeira: relatorios financeiros, fechamento e exportacoes.
- v0.6 Inteligência Operacional: indicadores, alertas e analises.
- v0.7 Compras: fornecedores, sugestao de compra e reposicao.
- v0.8 Dashboard Executivo: visao gerencial consolidada.
- v0.9 Release Candidate: estabilizacao, documentacao e testes finais.
- v1.0 Primeira versão comercial: entrega comercial inicial.

## Funcionalidades implementadas

- Login JWT com perfis.
- Hierarquia de roles `OWNER`, `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`.
- Dashboard operacional.
- Categorias e produtos.
- Mesas e estados operacionais.
- Abertura, consulta, cancelamento e fechamento de comandas.
- Criacao e cancelamento de pedidos.
- Fluxo de cozinha.
- Registro de pagamentos.
- Calculo de total, valor pago e saldo da comanda.
- Autoria operacional pelo usuario autenticado.
- Minha Conta e alteracao de senha.
- Relatorios operacionais basicos.
- Temas dark e light.
- Layout responsivo.
- Documentacao oficial de produto, arquitetura, padroes e ADRs.

## Funcionalidades planejadas

- Refresh token ou estrategia equivalente de sessao segura.
- Recuperacao de senha.
- Politica de tentativas de login.
- Auditoria completa.
- Edicao administrativa de usuarios.
- Paginacao navegavel e filtros por periodo.
- Estoque por insumos.
- Receitas e consumo automatico.
- Ledger de estoque.
- Compras e fornecedores.
- Relatorios financeiros.
- Exportacao de relatorios.
- Dashboard executivo.
- Preparacao para release comercial.

## Funcionalidades fora do escopo atual

- Delivery e marketplaces.
- WhatsApp e QR Code.
- Nota fiscal.
- Integracao com maquininha.
- Aplicativo mobile.
- Multiempresa e multiunidade.
- SaaS publico.
- WebSocket.
- Impressao parcial.
- Modo chamada.

Esses itens podem ser reavaliados em fases futuras, mas nao fazem parte do
escopo atual.

## Processo oficial de desenvolvimento

1. Definir o problema real do cliente.
2. Registrar como o cliente resolve o problema hoje.
3. Explicar como o HubOn resolvera melhor.
4. Atualizar roadmap, regras de negocio e arquitetura quando necessario.
5. Criar ou atualizar ADR se houver decisao estrutural.
6. Definir modelo de dados e contrato de API antes da implementacao.
7. Implementar em backend e frontend somente apos alinhamento documental.
8. Criar ou atualizar testes proporcionais ao risco.
9. Atualizar documentacao, changelog e README.
10. Revisar seguranca, migrations e impacto operacional antes de merge.

## Diferenciais competitivos

- Foco em operacao real de pequenos negocios de alimentacao.
- Fluxo integrado entre mesa, comanda, pedido, cozinha e pagamento.
- Regras financeiras protegidas no backend.
- Base pronta para evoluir estoque inteligente.
- Documentacao oficial desde o inicio.
- Arquitetura simples, auditavel e adequada para evolucao incremental.
- Controle por perfis operacionais.
- Produto pensado para reduzir erro operacional, nao apenas registrar dados.
