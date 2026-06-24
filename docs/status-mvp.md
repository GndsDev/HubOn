# Status do MVP

## Funcional

- Dashboard com dados reais da API, loading, erro e estados vazios.
- Dashboard com atualização automática a cada 30 segundos.
- Categorias: listar, criar, editar, ativar e desativar.
- Produtos: listar, buscar, criar, editar, ativar e desativar.
- Mesas: filtros, cadastro, edição, status efetivo e ações operacionais.
- Comandas: abertura, consulta, cancelamento e fechamento.
- Pedidos: múltiplos itens, snapshots, envio e cancelamento.
- Cozinha: Kanban com avanço sequencial até entrega e atualização automática a cada 15 segundos.
- Caixa: histórico, pagamento, saldo e fechamento.
- Usuários: consulta e criação com hierarquia de permissões.
- Login JWT com usuário autenticado e roles.
- Minha Conta: consulta dos dados autenticados e alteração da própria senha.
- Rotas e endpoints protegidos por perfil.
- Autoria de comanda, pedido e pagamento pelo usuário autenticado no backend.
- Relatórios: resumo básico alimentado pelo Dashboard.
- Rotas Angular reais com suporte a recarga e URL direta.
- Toasts de sucesso, erro e informação.
- Tratamento global de erros em JSON.
- Seeder idempotente para perfis, usuário OWNER, usuário ADMIN, catálogo e mesas.
- Perfis `local` e `prod`, CORS configurável e OSIV desativado.
- Dashboard com agregações no banco e somente cinco pedidos recentes.
- Lista operacional limitada aos 100 pedidos mais recentes, com itens em lote.
- Modais principais com semântica, Escape, foco inicial e restauração de foco.
- Toasts de erro anunciados como `alert`.
- Regras financeiras protegem pagamento excedente, cancelamentos e concorrência.
- Regras de criação de usuários protegem OWNER/ADMIN contra escalonamento indevido.
- Build de produção do frontend configurado.

## Parcial

- Autenticação usa JWT sem refresh token, sem recuperação de senha e sem bloqueio por tentativas.
- Cadastro de usuários cobre criação inicial de perfis permitidos, mas ainda não possui edição administrativa nem auditoria completa.
- Relatórios não possuem filtro por período nem exportação.
- Dashboard usa agregações simples; a atualização é por polling, sem WebSocket.
- Testes automatizados cobrem regras financeiras, estados operacionais e autorização por perfil.
- A lista de pedidos ainda não possui paginação navegável; mostra os 100 mais recentes.
- `imageUrl` continua no contrato da API, mas o campo foi ocultado da interface até existir exibição consistente.
- `OrderItemStatus.CANCELLED` permanece reservado para cancelamento por item após o MVP.

## Fora do MVP

- Delivery, iFood, WhatsApp e QR Code.
- Aplicativo mobile.
- Nota fiscal, impressão fiscal e integração com maquininha.
- Estoque inteligente por insumos, receitas e baixa automática.
- Multiempresa e multiunidade.
- Assinatura SaaS.
- Refresh token, recuperação de senha, política de tentativas e auditoria completa.
- WebSocket.
- Paginação e relatórios exportáveis.
- Impressão parcial e modo chamada.

## Próxima fase planejada

O próximo grande módulo planejado é o **Estoque Inteligente**, voltado a
trailers, lanchonetes e pequenos restaurantes. A evolução foi dividida em
estoque base, receitas com baixa automática, capacidade de produção e compras
com fornecedores.

Esse módulo ainda não foi implementado: não há telas, endpoints, entidades ou
migrations de estoque entregues. As decisões iniciais para v0.4.0 e v0.4.1 —
incluindo unidades base, momento da baixa, estorno, custos e permissões — já
foram documentadas como planejamento. A visão de produto, as decisões e os
pontos ainda em aberto estão em [stock-management.md](stock-management.md).

## Validação realizada

- Frontend compilado com `npm run build`.
- Backend validado com `.\mvnw.cmd test`.
- Backend possui 37 testes passando em suítes de integração para regras financeiras, consistência operacional, seeder e autorização.
- Frontend possui testes para app, AuthService e Minha Conta; o TypeScript dos specs foi validado com `npx tsc -p tsconfig.spec.json --noEmit`.
- Flyway validou a migration existente.
- Hibernate iniciou com `ddl-auto=validate`.
- `spring.jpa.open-in-view=false` é aplicado explicitamente.

O runner de testes Angular pode falhar dentro de ambientes com sandbox restrito
ao resolver arquivos locais. O build de produção é a validação confiável usada
neste workspace.

Os comandos, a cobertura e a interpretação de falhas estão documentados em
`testing.md`. O roteiro integrado está em `manual-test-flow.md`.
