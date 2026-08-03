# Venda no balcão

## Conceito

Uma venda de balcão é uma comanda independente do tipo `COUNTER`. Ela não ocupa mesa, nunca usa uma "Mesa Balcão" fictícia e não é reutilizada entre clientes. O identificador operacional é `Balcão #<id da comanda>`; o nome do cliente, quando informado, apenas complementa esse rótulo.

Uma venda de balcão permanece disponível na tela de Balcão até ser finalizada ou cancelada. Pagamento, preparo, entrega e fechamento são dimensões distintas.

## Central de atendimento

A rota `/balcao` é a central operacional e separa:

- **Ativos:** vendas que ainda exigem alguma ação;
- **Finalizados hoje:** vendas encerradas na data comercial atual;
- **Histórico:** vendas anteriores, pesquisáveis por período, número, cliente, situação e operador.

Cada atendimento ativo apresenta identificação, horário, responsável, quantidade de itens, total, valor pago, saldo, estado do atendimento, estado do preparo, estado financeiro e próxima ação. O indicador da navegação mostra a quantidade ativa e informa, também por texto e ícone, quando há venda pronta para entrega.

A rota `/balcao/:counterTabId` abre diretamente um atendimento existente. Ela pode ser recarregada ou acessada depois de navegar por outra área sem recriar comanda, pedido, item, pagamento ou movimentação de estoque.

## Persistência

1. **Nova venda no balcão** cria imediatamente uma comanda `COUNTER` no backend.
2. O primeiro item cria um pedido `CREATED`; alterações posteriores atualizam esse mesmo rascunho.
3. Itens, quantidades, variações, escolhas e observações são salvos no backend durante a montagem.
4. Um rascunho vazio continua representado pela comanda persistida.
5. A confirmação continua sendo a fronteira transacional para preço, disponibilidade, estoque e idempotência. Itens preparados ficam aguardando pagamento.

O componente não usa `sessionStorage` nem estado local como fonte de verdade. O estado local serve somente para edição da tela e sempre é reconstruído pela API.

## Estados derivados

Os estados são calculados a partir da comanda, dos pedidos, dos itens e dos pagamentos existentes. Nenhuma coluna redundante foi criada.

### Atendimento

- Em montagem;
- Confirmado;
- Em andamento;
- Pronto para finalizar;
- Finalizado;
- Cancelado.

### Preparo

- Sem preparo;
- Aguardando pagamento;
- Aguardando preparo;
- Em preparo;
- Parcialmente pronto;
- Pronto;
- Entregue.

### Financeiro

- Não pago;
- Parcialmente pago;
- Pago;
- Cancelado.

Em uma venda mista, as quantidades por estado continuam visíveis. Por exemplo, uma bebida direta pode aparecer pronta enquanto outro item permanece em preparo.

## Fluxo operacional

1. O operador inicia uma venda e recebe imediatamente o número do Balcão.
2. Monta o pedido com produtos, variações, escolhas, quantidades e observações.
3. Confirma o pedido uma única vez.
4. Itens de entrega direta ficam prontos; itens preparados ficam **Aguardando pagamento**.
5. Pagamento parcial mantém os itens preparados aguardando.
6. O pagamento integral inicia automaticamente os itens preparados elegíveis, na mesma transação do backend.
7. Cada item preparado é marcado como pronto e cada item pronto é marcado como entregue.
8. Somente depois da entrega e da quitação a ação **Finalizar venda** fecha a comanda.

O pagamento nunca remove uma venda ainda em preparo da lista de ativos. A atualização ocorre depois das ações e por consulta periódica controlada, sem WebSocket.

## Integrações

- **Balcão:** visão operacional completa e ponto principal para retomar a venda.
- **Caixa:** turno, valores recebidos, métodos, sangrias, suprimentos, conferência e histórico; pagamentos pendentes são apenas links para a origem.
- **Pedidos:** visão operacional dos itens preparados e diretos, sem formulário próprio de pagamento.
- **Estoque:** baixas automáticas continuam ocorrendo uma vez na confirmação e estornos uma vez no cancelamento permitido.
- **Relatório mensal:** inclui vendas de balcão fechadas na data comercial e preserva o canal `COUNTER`.

## Endpoints

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/api/tabs/counter/active` | Lista atendimentos ativos com estados e próxima ação derivados. |
| `GET` | `/api/tabs/counter/finished-today` | Lista vendas finalizadas na data comercial atual. |
| `GET` | `/api/tabs/counter/history` | Pesquisa o histórico com filtros opcionais. |
| `GET` | `/api/tabs/counter/{id}` | Recupera resumo, identificação e pedidos de uma venda. |
| `POST` | `/api/tabs/counter` | Cria uma nova comanda `COUNTER`. |
| `PATCH` | `/api/tabs/counter/{id}` | Atualiza os dados opcionais do cliente. |
| `POST` | `/api/tabs/counter/{id}/finish` | Fecha uma venda entregue e quitada. |

## Cancelamentos

As regras existentes permanecem: pedido entregue ou com pagamento não pode ser cancelado. Cancelamentos confirmados revertem baixa automática uma única vez. A comanda de balcão pode ser cancelada depois que seus pedidos estiverem cancelados, desde que não exista pagamento.

## Permissões

- `OWNER` e `ADMIN`: operação completa;
- `CASHIER`: criar, confirmar, pagar, entregar, cancelar conforme as regras e finalizar;
- `WAITER`: sem acesso ao Balcão, inclusive por URL ou API direta;
- `KITCHEN`: versão filtrada de Pedidos, somente com itens preparados e a ação **Marcar como pronto**, sem acesso financeiro.

## Decisão de banco

Os estados do Balcão continuam derivados. A migration V8 foi criada somente para
persistir turnos e movimentações de Caixa e associar cada pagamento ao turno
aberto em que foi recebido.
