# Status do MVP

## Documentação oficial

O HubOn agora possui documentação oficial de produto e arquitetura. A visão de
produto, roadmap, padrões, decisões arquiteturais, regras de negócio, modelo de
dados, API, implantação, testes e portfólio estão organizados em `docs/`.

Documentos centrais:

- [Product Vision](product/PRODUCT_VISION.md)
- [Roadmap](product/ROADMAP.md)
- [Standards](STANDARDS.md)
- [Architecture](architecture/architecture.md)
- [ADRs](adr/README.md)

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
- Estoque Inteligente com itens manuais, baixa automática por variação,
  ledger e estorno por cancelamento.
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
- Multiempresa e multiunidade.
- Assinatura SaaS.
- Refresh token, recuperação de senha, política de tentativas e auditoria completa.
- WebSocket.
- Paginação e relatórios exportáveis.
- Impressão parcial e modo chamada.

## Próxima fase planejada

O **Estoque Inteligente** já possui o recorte híbrido implementado: itens
manuais, itens `DIRECT_SALE`, vínculo por variação, baixa na confirmação do
pedido e estorno idempotente em cancelamentos elegíveis.

Continuam fora do MVP: ficha técnica, receita multi-ingrediente, produção,
rendimento, conversão automática de unidades, compras, fornecedores, lotes,
validade e múltiplos depósitos. A visão atual está em
[stock-management.md](business/stock-management.md).

## Validação realizada

- Frontend compilado com `npm run build`.
- Backend validado com `.\mvnw.cmd test`.
- Backend possui 83 testes passando, incluindo Balcão persistente, relatório mensal, catálogo, pedidos, estoque, regras financeiras, consistência operacional, seeder e autorização.
- Frontend possui 59 testes passando em 16 arquivos de especificação.
- Flyway validou V1 a V7 no banco exclusivo `hubon_test`.
- Hibernate iniciou com `ddl-auto=validate`.
- A auditoria no Microsoft Edge aprovou 184 verificações nos temas claro e escuro.
- `spring.jpa.open-in-view=false` é aplicado explicitamente.

O runner de testes Angular pode falhar dentro de ambientes com sandbox restrito
ao resolver arquivos locais. O build de produção é a validação confiável usada
neste workspace.

Os comandos, a cobertura e a interpretação de falhas estão documentados em
[testing.md](testing/testing.md). O roteiro integrado está em
[manual-test-flow.md](testing/manual-test-flow.md).
- central de venda no balcão independente, persistente e sem mesa fictícia, com retomada pela URL, estados separados, pagamento, preparo, entrega e fechamento;
- relatório mensal por data comercial de fechamento, canal, produtos, categorias, pagamentos, dias e cancelamentos;
- exportação CSV e impressão amigável do relatório;
- overlays globais com foco, teclado, scroll lock e menus ajustados a viewport;
