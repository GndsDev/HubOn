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
- Usuários: consulta real dos usuários locais.
- Operador local selecionável na topbar, persistido no navegador e usado nas operações autorais.
- Relatórios: resumo básico alimentado pelo Dashboard.
- Rotas Angular reais com suporte a recarga e URL direta.
- Toasts de sucesso, erro e informação.
- Tratamento global de erros em JSON.
- Seeder idempotente para perfis, usuário administrador, catálogo e mesas.
- Perfis `local` e `prod`, CORS configurável e OSIV desativado.
- Dashboard com agregações no banco e somente cinco pedidos recentes.
- Lista operacional limitada aos 100 pedidos mais recentes, com itens em lote.
- Modais principais com semântica, Escape, foco inicial e restauração de foco.
- Toasts de erro anunciados como `alert`.
- Regras financeiras protegem pagamento excedente, cancelamentos e concorrência.
- Build de produção do frontend configurado.

## Parcial

- Usuários são somente leitura; não existe CRUD, login ou permissões avançadas.
- Relatórios não possuem filtro por período nem exportação.
- Dashboard usa agregações simples; a atualização é por polling, sem WebSocket.
- O operador local ainda não possui autenticação nem autorização por perfil.
- Testes automatizados cobrem regras financeiras, estados operacionais, contexto do aplicativo e persistência do operador local.
- A lista de pedidos ainda não possui paginação navegável; mostra os 100 mais recentes.
- `imageUrl` continua no contrato da API, mas o campo foi ocultado da interface até existir exibição consistente.
- `OrderItemStatus.CANCELLED` permanece reservado para cancelamento por item após o MVP.

## Fora do MVP

- Delivery, iFood, WhatsApp e QR Code.
- Aplicativo mobile.
- Nota fiscal, impressão fiscal e integração com maquininha.
- Estoque avançado.
- Multiempresa e multiunidade.
- Assinatura SaaS.
- JWT, permissões avançadas e auditoria.
- WebSocket.
- Paginação e relatórios exportáveis.
- Impressão parcial, modo chamada e cadastro de usuários.

## Validação realizada

- Frontend compilado com `npm run build`.
- Backend validado com `.\mvnw.cmd test`.
- Backend possui três suítes e 19 testes na validação atual.
- Frontend possui seis testes em duas suítes.
- Flyway validou a migration existente.
- Hibernate iniciou com `ddl-auto=validate`.
- `spring.jpa.open-in-view=false` é aplicado explicitamente.

O runner de testes Angular pode falhar dentro de ambientes com sandbox restrito
ao resolver arquivos locais. O build de produção é a validação confiável usada
neste workspace.

Os comandos, a cobertura e a interpretação de falhas estão documentados em
`testing.md`. O roteiro integrado está em `manual-test-flow.md`.
