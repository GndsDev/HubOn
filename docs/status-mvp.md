# Status do MVP

## Funcional

- Dashboard consumindo agregações reais do backend.
- Categorias e produtos com cadastro, edição e ativação/desativação.
- Mesas com filtros, cadastro, edição, abertura e consulta de comanda.
- Comandas com abertura, detalhes, cancelamento e fechamento.
- Pedidos com múltiplos itens, snapshots, envio à cozinha e cancelamento.
- Cozinha com fluxo sequencial até a entrega.
- Caixa com pagamentos reais, saldo restante e fechamento.
- Tratamento global de erros, CORS local, Security liberado e feedback por toast.
- Seeder idempotente para `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`.

## Parcial

- Relatórios usam dados ilustrativos e ainda não exportam arquivos.
- Usuários aparecem como mock visual; não há gestão completa nem autenticação.
- O Dashboard usa agregações simples, adequadas ao MVP local.
- Não há atualização em tempo real; as telas recarregam após ações.

## Próxima versão

- Autenticação JWT e autorização por perfil.
- CRUD completo de usuários.
- Relatórios por período e exportação.
- Atualização em tempo real para cozinha e salão.
- Testes automatizados de integração com banco dedicado.
- Pagamentos divididos com melhor experiência e impressão fiscal.
- Paginação, auditoria e observabilidade.
