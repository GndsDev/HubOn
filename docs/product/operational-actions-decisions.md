# Matriz de ações operacionais

## Balcão

| Estado | Ação principal | Ações secundárias | Ações removidas ou ocultas | Regra |
| --- | --- | --- | --- | --- |
| Atendimento vazio | Adicionar itens | Editar identificação; cancelar venda | Confirmar, pagar, entregar e finalizar | A comanda já existe, mas ainda não há pedido vendável. |
| Em montagem | Confirmar pedido | Editar itens; editar identificação; cancelar venda | Enviar para cozinha, processar e registrar venda | A confirmação valida catálogo e estoque. |
| Aguardando pagamento | Registrar pagamento | Consultar itens | Iniciar preparo, entregar e finalizar | Pagamento parcial mantém o preparo aguardando. |
| Pagamento parcial | Completar pagamento | Consultar itens | Iniciar preparo, entregar e finalizar | O preparo começa automaticamente quando o saldo chega a zero. |
| Em preparo | Acompanhar preparo | Consultar itens | Iniciar preparo, pagar novamente e finalizar | Cada item oferece somente **Marcar como pronto**. |
| Pronto com saldo | Registrar pagamento | Consultar itens | Entregar e finalizar | A venda deve estar quitada antes da entrega operacional. |
| Pronto e pago | Marcar como entregue | Consultar itens | Registrar pagamento e finalizar | Pagamento não equivale à entrega. |
| Entregue com saldo | Registrar pagamento | Consultar itens | Entregar novamente e finalizar | A quitação ainda é obrigatória. |
| Entregue e pago | Finalizar venda | Consultar itens | Pagamento, preparo e entrega | O fechamento é a última ação explícita. |
| Finalizado ou cancelado | Consultar atendimento | Voltar à central | Todas as ações de alteração | Histórico é somente leitura. |

## Demais telas

| Tela | Estado ou contexto | Ação principal | Ações secundárias | Decisão |
| --- | --- | --- | --- | --- |
| Dashboard | Indicador acionável | Abrir a área correspondente | Atualizar indicadores | Métricas levam ao Balcão, Pedidos, Estoque, Caixa ou Relatório. |
| Produtos | Produto cadastrado | Gerenciar produto | Alternar disponibilidade | Informações, variações, escolhas e estoque ficam em uma única entrada. |
| Estoque | Item cadastrado | Registrar movimento adequado | Gerenciar item; histórico; vínculos | Entrada, saída, perda e ajuste permanecem operações distintas e auditáveis. |
| Pedidos | Pedido de mesa em rascunho | Confirmar pedido | Editar; cancelar | A progressão operacional fica fora do menu. |
| Pedidos | Pedido de balcão | Abrir atendimento | Consultar detalhes | O Balcão concentra a próxima ação e evita confirmação duplicada. |
| Pedidos | Item em preparo | Marcar como pronto | Abrir origem | Não existe ação manual para iniciar preparo. |
| Pedidos | Item pronto | Marcar como entregue | Abrir origem | O perfil `KITCHEN` não recebe a ação de entrega. |
| Caixa fechado | Abrir caixa | Consultar último fechamento | Nenhuma operação de venda | O turno precisa existir antes de movimentar dinheiro. |
| Caixa aberto | Fechar caixa | Registrar sangria; registrar suprimento | Registrar pagamento; montar ou concluir venda | Pagamentos entram automaticamente no turno aberto. |
| Comandas | Saldo pendente ou parcial | Registrar ou completar pagamento | Cancelar quando permitido | A venda de mesa é recebida dentro da própria comanda. |
| Relatório | Dados carregados | Consultar período | Imprimir; exportar CSV | Comandos inativos ou prometidos foram removidos. |

## Princípios

- Cada contexto apresenta uma única ação principal.
- A próxima ação operacional nunca fica escondida no menu de três pontos.
- Ações destrutivas exigem confirmação e só aparecem quando a API permite.
- Botões equivalentes ou que levam à mesma transição não são exibidos juntos.
- O frontend comunica as regras, mas o backend continua sendo a autoridade de segurança e consistência.
