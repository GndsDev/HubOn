# Glossário

| Termo | Significado no HubOn |
| --- | --- |
| Venda | Registro comercial central, do tipo `TABLE` ou `COUNTER`. |
| Comanda | Nome usado na interface para uma venda `TABLE`, identificada pelo número da mesa. |
| Balcão | Venda `COUNTER`, sem número de mesa. |
| Item ativo | Lançamento que não foi removido nem cancelado e compõe o valor da venda. |
| Remoção | Correção operacional sem motivo obrigatório; mantém auditoria e não entra nas métricas de cancelamento. |
| Cancelamento | Evento de negócio com motivo, responsável e data, considerado nos relatórios. |
| Escolha | Opção selecionável de um produto, com preço adicional opcional. |
| Item de estoque | Bem controlado por saldo e unidade de medida. |
| Vínculo automático | Relação entre produto ou escolha e item de estoque para gerar baixa na venda. |
| Ledger | Histórico imutável das movimentações de estoque. |
| Turno de caixa | Período entre abertura e fechamento que recebe pagamentos e movimentos manuais. |
| Suprimento | Entrada manual de dinheiro no caixa. |
| Sangria | Retirada manual de dinheiro do caixa. |
| Origem | Filtro de relatórios: Todas, Comandas ou Balcão. |
| Dono | Usuário `OWNER`, responsável máximo e único perfil que cria Gerentes. |
| Gerente | Usuário `ADMIN`, com acesso à operação atual. |
