# Fluxo de teste manual

## Preparação

1. Inicie o PostgreSQL e confirme o banco local configurado.
2. Em `backend`, execute a aplicação com o perfil `local`.
3. Em `frontend`, execute `npm start`.
4. Abra a aplicação no Microsoft Edge.
5. Entre com um usuário `OWNER` configurado localmente.
6. Confirme que frontend e backend não exibem erros no console.

Nunca execute a suíte automatizada contra o banco local. Os testes de integração devem usar exclusivamente `hubon_test`, protegido por `IntegrationTestDatabaseGuard`.

## Venda persistente no balcão

### Montagem e retomada

1. Acesse **Balcão** e confirme as áreas **Ativos**, **Finalizados hoje** e **Histórico**.
2. Clique em **Nova venda no balcão**.
3. Confirme que a URL contém o identificador do atendimento.
4. Adicione um produto de entrega direta e outro que exija preparo.
5. Escolha variações e opções, altere quantidades e informe uma observação.
6. Volte para outra rota sem confirmar o pedido.
7. Retorne ao Balcão e confirme que a venda continua em **Ativos**.
8. Abra o atendimento e valide todos os itens, quantidades, escolhas e observações.
9. Atualize o navegador e valide novamente os dados restaurados pelo backend.
10. Edite e remova um item; recarregue para confirmar a persistência.

Resultado esperado: a venda nunca parece perdida, não é recriada e não aparece somente no Caixa.

### Confirmação, pagamento e preparo

1. Clique em **Confirmar pedido** uma única vez.
2. Confirme que o item direto aparece como pronto.
3. Confirme que o item preparado aparece na Cozinha como `Balcão #<id>`.
4. Registre um pagamento parcial no Balcão ou no Caixa.
5. Confirme separadamente os estados **Parcialmente pago** e **Aguardando preparo**.
6. Complete o pagamento antes de terminar o preparo.
7. Confirme que a venda continua em **Ativos** e na fila da Cozinha.
8. Na Cozinha, avance o item para **Em preparo** e depois **Pronto**.
9. Retorne ao Balcão ou aguarde a atualização controlada.
10. Confirme a divisão das quantidades prontas, em preparo e entregues.

Resultado esperado: pagamento não remove nem finaliza preparo; Balcão, Caixa e Cozinha mostram dimensões coerentes.

### Entrega e fechamento

1. Com todos os itens prontos e a venda paga, confirme que a única ação principal é **Marcar como entregue**.
2. Marque o pedido como entregue.
3. Confirme que a venda ainda permanece ativa com **Finalizar venda**.
4. Finalize a venda.
5. Confirme que ela saiu de **Ativos** e entrou em **Finalizados hoje**.
6. Pesquise a venda no **Histórico** pelo número e pelo cliente.
7. Valide a venda no Relatório mensal do período atual.

Resultado esperado: entrega e fechamento são ações diferentes e a venda só deixa a lista ativa após o fechamento.

## Venda direta

1. Inicie outra venda com somente produto `DIRECT_SERVICE`.
2. Confirme o pedido e valide que ele não aparece na Cozinha.
3. Registre o pagamento.
4. Marque como entregue e finalize.
5. Se existir vínculo de estoque, confirme uma única baixa automática.

## Cancelamento

1. Crie uma venda sem pagamento.
2. Informe um motivo e cancele o atendimento.
3. Confirme que ele saiu de **Ativos** e permanece pesquisável no Histórico.
4. Em outro atendimento, registre um pagamento e tente cancelar.
5. Confirme a mensagem de bloqueio da regra financeira.
6. Em um pedido confirmado com baixa automática, cancele quando permitido e valide um único estorno.

## Regressão de mesa

1. Em **Mesas**, abra uma comanda em uma mesa livre.
2. Crie e confirme um pedido de mesa.
3. Avance os itens preparados na Cozinha.
4. Entregue o pedido, pague o valor exato e feche a comanda.
5. Confirme que a mesa voltou para **Livre**.
6. Tente abrir duas comandas na mesma mesa e confirme o bloqueio.

## Catálogo e estoque

1. Crie ou edite categoria, produto, variação e escolhas.
2. Confirme que **Gerenciar produto** concentra as configurações sem modais principais sobrepostos.
3. Desative produto, variação ou categoria e confirme que não podem ser vendidos.
4. No Estoque, valide indicadores, filtros, histórico e os modos **Manual** e **Venda direta**.
5. Registre separadamente entrada, saída, perda e ajuste.
6. Confirme que menus do primeiro e do último item permanecem dentro da viewport.
7. Valide os estados textual e visualmente: normal, baixo, zerado e inativo.

## Caixa, Pedidos e Cozinha

1. Em **Pedidos**, confirme a origem Mesa ou Balcão, o financeiro e a próxima ação.
2. Para venda de balcão, use **Abrir atendimento** e confirme que não há confirmação duplicada.
3. No **Caixa**, localize pagamentos pendentes, parciais, pagos aguardando entrega e prontos para fechamento.
4. Confirme que **Fechar comanda** não aparece ou fica bloqueado antes da entrega.
5. Na **Cozinha**, valide as colunas **Aguardando**, **Em preparo** e **Prontos**.
6. Confirme que cada item apresenta somente **Iniciar preparo** ou **Marcar como pronto**.
7. Confirme que item pronto não apresenta nova ação de preparo nem ação de entrega.

## Relatório e Dashboard

1. No Dashboard, valide vendas do dia, vendas ativas no Balcão, pedidos prontos e pagamentos pendentes.
2. Abra cada indicador e confirme o destino correto.
3. No Relatório mensal, altere mês, ano e canal.
4. Confira receita, ticket médio, quantidade de vendas, canais, produtos, variações, categorias, pagamentos, vendas por dia, cancelamentos e comparação mensal.
5. Valide impressão e CSV somente quando houver dados.
6. Confirme o estado vazio em período sem vendas.

## Overlays e acessibilidade

1. Abra formulários, confirmações e menus no primeiro e no último item das listas.
2. Confirme que somente o nível superior fecha com `Escape`.
3. Navegue com `Tab` e `Shift+Tab` e confirme o foco preso ao diálogo ativo.
4. Feche o diálogo e confirme o retorno do foco ao acionador.
5. Confirme rodapé acessível, conteúdo rolável e bloqueio do scroll da página.
6. Clique fora de um menu e confirme o fechamento.
7. Confirme que nenhum overlay é cortado por tabela, card ou container com `overflow`.

## Temas e resoluções

Repita a auditoria nos temas claro e escuro e nas resoluções:

- 1366x768;
- 1440x900;
- 1920x1080;
- 1366x650.

Em cada combinação, validar:

- ausência de rolagem horizontal na página;
- sidebar e indicador do Balcão estáveis;
- cabeçalhos e botões sem sobreposição;
- textos secundários legíveis;
- tabelas e cards sem conteúdo cortado;
- modais e menus dentro da viewport;
- uma ação principal por estado;
- estados vazios, carregamento e erro consistentes;
- todos os textos visíveis corretamente escritos em português brasileiro.
