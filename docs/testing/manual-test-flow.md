# Fluxo de teste manual

## Preparacao

1. Inicie o PostgreSQL e confirme o banco `hubon_db`.
2. Em `backend`, execute `.\mvnw.cmd spring-boot:run`.
3. Em `frontend`, execute `npm start`.
4. Abra `http://localhost:4200/dashboard`.
5. Faca login com o `OWNER` configurado em `hubon.seed.owner.email` e
   `hubon.seed.owner.password`.

## Fluxo principal

1. Em **Categorias**, crie uma categoria ativa.
2. Em **Produtos**, crie um produto ativo, escolha o fluxo de preparo e salve.
3. Abra **Variacoes** do produto e crie uma variacao ativa com preco maior ou
   igual a zero.
4. Em **Mesas**, crie uma mesa com status Livre.
5. Clique em **Abrir comanda**.
6. Confirme que a mesa aparece como Ocupada.
7. Em **Pedidos**, crie um pedido para a comanda.
8. Adicione um ou mais produtos com quantidade maior que zero; se houver varias
   variacoes ativas, selecione a variacao desejada.
9. Envie o pedido para a cozinha quando houver itens `KITCHEN`.
10. Em **Cozinha**, avance para Preparando.
11. Avance para Pronto.
12. Marque como Entregue.
13. Em **Caixa**, selecione a comanda.
14. Registre o valor restante usando um metodo valido.
15. Confirme que o saldo ficou zerado.
16. Feche a comanda.
17. Volte para **Mesas** e confirme que a mesa esta Livre.
18. Abra o **Dashboard** e atualize os dados.
19. Confira pedidos recentes, produtos vendidos e resumo do caixa.

## Casos negativos

### Duas comandas

1. Abra uma comanda em uma mesa.
2. Tente abrir outra na mesma mesa.
3. Resultado esperado: operacao bloqueada.

### Mesa desativada

1. Desative uma mesa livre.
2. Confirme badge Desativada, filtro Desativadas e acao indisponivel.
3. Tente abrir comanda.
4. Resultado esperado: operacao bloqueada.
5. Ative novamente e confirme que volta como Livre.

### Produto ou variacao inativa

1. Desative um produto.
2. Tente inclui-lo em pedido.
3. Resultado esperado: nao aparece na selecao e a API tambem rejeita.
4. Reative o produto, desative uma variacao e tente vender essa variacao.
5. Resultado esperado: variacao inativa nao pode ser vendida.

### Atendimento direto

1. Crie um produto com fluxo `DIRECT_SERVICE` e uma variacao ativa.
2. Crie um pedido somente com esse item.
3. Resultado esperado: pedido fica pronto sem aparecer na Cozinha.
4. Se houver vinculo de estoque, confirme baixa automatica na criacao do pedido.

### Pagamento invalido

1. Informe zero: deve ser bloqueado.
2. Informe valor maior que o saldo: deve ser bloqueado.
3. Tente fechar com saldo pendente: deve ser bloqueado.
4. Em um ambiente controlado, prepare uma comanda com pagamento excedente.
5. Resultado esperado: fechamento bloqueado.

### Cancelamentos apos pagamento

1. Abra uma comanda e crie um pedido.
2. Registre um pagamento parcial.
3. Tente cancelar o pedido.
4. Resultado esperado: cancelamento bloqueado.
5. Cancele previamente todos os pedidos em outra comanda sem pagamento.
6. Em ambiente controlado, prepare uma comanda cancelavel com pagamento e tente
   cancela-la.
7. Resultado esperado: cancelamento bloqueado.

Os cenarios que exigem preparacao direta de dados ja sao cobertos pelas suites
automatizadas do backend e nao devem ser executados em um banco de producao.

### Comanda com pedido entregue

1. Crie um pedido e avance ate Entregue.
2. Tente cancelar a comanda.
3. Resultado esperado: cancelamento bloqueado.
4. Pague o valor exato e feche a comanda.
5. Resultado esperado: fechamento permitido e mesa Livre.

### Categoria inativa

1. Desative uma categoria que possua produto ativo.
2. Tente criar um novo pedido com esse produto pela API.
3. Resultado esperado: venda bloqueada sem alterar pedidos antigos.

### Cozinha

1. Tente avancar um status fora da sequencia pela API.
2. Tente cancelar um pedido entregue.
3. Resultado esperado: erro de negocio em JSON.

## Rotas e responsividade

- Recarregue `/mesas` e confirme que a tela permanece em Mesas.
- Acesse uma rota inexistente e confirme redirecionamento para `/dashboard`.
- Recolha e expanda a sidebar varias vezes.
- Confirme ausencia de scroll horizontal e scrollbar duplicada.
- Teste em largura menor que 720px quando houver demanda de escopo mobile.
- Abra um formulario modal, confirme o foco inicial e pressione `Escape`.
- Alterne entre os temas dark e light e recarregue a pagina.
