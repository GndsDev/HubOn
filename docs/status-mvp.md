# Status do MVP

## Funcional

- Dashboard com dados reais da API, loading, erro e estados vazios.
- Categorias: listar, criar, editar, ativar e desativar.
- Produtos: listar, buscar, criar, editar, ativar e desativar.
- Mesas: filtros, cadastro, edição, status efetivo e ações operacionais.
- Comandas: abertura, consulta, cancelamento e fechamento.
- Pedidos: múltiplos itens, snapshots, envio e cancelamento.
- Cozinha: Kanban com avanço sequencial até entrega.
- Caixa: histórico, pagamento, saldo e fechamento.
- Usuários: consulta real dos usuários locais.
- Relatórios: resumo básico alimentado pelo Dashboard.
- Rotas Angular reais com suporte a recarga e URL direta.
- Toasts de sucesso, erro e informação.
- Tratamento global de erros em JSON.
- Seeder idempotente para perfis, usuário administrador, catálogo e mesas.

## Parcial

- Usuários são somente leitura; não existe CRUD, login ou permissões avançadas.
- Relatórios não possuem filtro por período nem exportação.
- Dashboard usa agregações simples e sem atualização em tempo real.
- A aplicação escolhe o primeiro usuário ativo para registrar operações.
- Testes automatizados ainda cobrem principalmente a inicialização do contexto.

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

## Validação realizada

- Frontend compilado com `npm run build`.
- Backend validado com `.\mvnw.cmd test`.
- Flyway validou a migration existente.
- Hibernate iniciou com `ddl-auto=validate`.
- Endpoints reais de Dashboard e Usuários responderam durante a validação.

O runner de testes Angular pode falhar dentro de ambientes com sandbox restrito
ao resolver arquivos locais. O build de produção é a validação confiável usada
neste workspace.
