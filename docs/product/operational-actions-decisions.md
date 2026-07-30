# Matriz de ações operacionais

## Balcão

| Estado | Ação principal | Ações secundárias | Ações removidas ou ocultas | Regra |
| --- | --- | --- | --- | --- |
| Atendimento vazio | Adicionar itens | Editar identificação; cancelar venda | Confirmar, pagar, entregar e finalizar | A comanda já existe, mas ainda não há pedido vendável. |
| Em montagem | Confirmar pedido | Editar itens; editar identificação; cancelar venda | Enviar para cozinha, processar e registrar venda | A confirmação é a única fronteira transacional. |
| Aguardando ou em preparo | Acompanhar preparo | Registrar pagamento; cancelar quando permitido | Entregar e finalizar | Pagamento e preparo continuam independentes. |
| Pronto com saldo | Registrar pagamento | Consultar itens | Entregar e finalizar | A venda deve estar quitada antes da entrega operacional. |
| Pronto e pago | Marcar como entregue | Consultar itens | Registrar pagamento e finalizar | Pagamento não equivale à entrega. |
| Entregue com saldo | Registrar pagamento | Consultar itens | Entregar novamente e finalizar | A quitação ainda é obrigatória. |
| Entregue e pago | Finalizar venda | Consultar itens | Pagamento, preparo e entrega | O fechamento é a última ação explícita. |
| Finalizado ou cancelado | Consultar atendimento | Voltar à central | Todas as ações de alteração | Histórico é somente leitura. |

## Demais telas

| Tela | Estado ou contexto | Ação principal | Ações secundárias | Decisão |
| --- | --- | --- | --- | --- |
| Dashboard | Indicador acionável | Abrir a área correspondente | Atualizar indicadores | Métricas levam ao Balcão, Caixa, Cozinha ou Relatório. |
| Produtos | Produto cadastrado | Gerenciar produto | Alternar disponibilidade | Informações, variações, escolhas e estoque ficam em uma única entrada. |
| Estoque | Item cadastrado | Registrar movimento adequado | Gerenciar item; histórico; vínculos | Entrada, saída, perda e ajuste permanecem operações distintas e auditáveis. |
| Pedidos | Pedido de mesa em rascunho | Confirmar pedido | Editar; cancelar | A progressão operacional fica fora do menu. |
| Pedidos | Pedido de balcão | Abrir atendimento | Consultar detalhes | O Balcão concentra a próxima ação e evita confirmação duplicada. |
| Cozinha | Item aguardando | Iniciar preparo | Consultar identificação | Somente a próxima transição válida é exibida. |
| Cozinha | Item em preparo | Marcar como pronto | Consultar identificação | Entrega pertence ao Balcão ou ao fluxo da comanda. |
| Cozinha | Item pronto | Nenhuma ação de preparo | Consultar identificação | O item permanece informativo até a entrega. |
| Caixa | Saldo pendente ou parcial | Registrar pagamento | Abrir Balcão; ver pedido | Pagamento não fecha nem entrega automaticamente. |
| Caixa | Pago e aguardando preparo/entrega | Continuar no Balcão | Ver pedido | Fechamento fica bloqueado com justificativa visível. |
| Caixa | Entregue e pago | Fechar comanda ou finalizar venda | Ver pedido | A pré-condição operacional e financeira foi atendida. |
| Comandas | Aberta sem pagamento | Ação válida conforme o estado | Cancelar com confirmação | Cancelamento só aparece quando permitido. |
| Relatório | Dados carregados | Consultar período | Imprimir; exportar CSV | Comandos inativos ou prometidos foram removidos. |

## Princípios

- Cada contexto apresenta uma única ação principal.
- A próxima ação operacional nunca fica escondida no menu de três pontos.
- Ações destrutivas exigem confirmação e só aparecem quando a API permite.
- Botões equivalentes ou que levam à mesma transição não são exibidos juntos.
- O frontend comunica as regras, mas o backend continua sendo a autoridade de segurança e consistência.
