# Fluxo de teste manual

## Preparação

1. Inicie o PostgreSQL e confirme o banco `hubon_db`.
2. Em `backend`, execute `.\mvnw.cmd spring-boot:run`.
3. Em `frontend`, execute `npm start`.
4. Abra `http://localhost:4200/dashboard`.
5. Faça login com `owner@hubon.local` e senha `owner123`.

## Fluxo principal

1. Em **Categorias**, crie uma categoria ativa.
2. Em **Produtos**, crie um produto ativo com preço maior ou igual a zero.
3. Em **Mesas**, crie uma mesa com status Livre.
4. Clique em **Abrir comanda**.
5. Confirme que a mesa aparece como Ocupada.
6. Em **Pedidos**, crie um pedido para a comanda.
7. Adicione um ou mais produtos com quantidade maior que zero.
8. Envie o pedido para a cozinha.
9. Em **Cozinha**, avance para Preparando.
10. Avance para Pronto.
11. Marque como Entregue.
12. Em **Caixa**, selecione a comanda.
13. Registre o valor restante usando um método válido.
14. Confirme que o saldo ficou zerado.
15. Feche a comanda.
16. Volte para **Mesas** e confirme que a mesa está Livre.
17. Abra o **Dashboard** e atualize os dados.
18. Confira pedidos recentes, produtos vendidos e resumo do caixa.

## Casos negativos

### Duas comandas

1. Abra uma comanda em uma mesa.
2. Tente abrir outra na mesma mesa.
3. Resultado esperado: operação bloqueada.

### Mesa desativada

1. Desative uma mesa livre.
2. Confirme badge Desativada, filtro Desativadas e ação indisponível.
3. Tente abrir comanda.
4. Resultado esperado: operação bloqueada.
5. Ative novamente e confirme que volta como Livre.

### Produto inativo

1. Desative um produto.
2. Tente incluí-lo em pedido.
3. Resultado esperado: não aparece na seleção e a API também rejeita.

### Pagamento inválido

1. Informe zero: deve ser bloqueado.
2. Informe valor maior que o saldo: deve ser bloqueado.
3. Tente fechar com saldo pendente: deve ser bloqueado.
4. Em um ambiente controlado, prepare uma comanda com pagamento excedente.
5. Resultado esperado: fechamento bloqueado.

### Cancelamentos após pagamento

1. Abra uma comanda e crie um pedido.
2. Registre um pagamento parcial.
3. Tente cancelar o pedido.
4. Resultado esperado: cancelamento bloqueado.
5. Cancele previamente todos os pedidos em outra comanda sem pagamento.
6. Em ambiente controlado, prepare uma comanda cancelável com pagamento e tente cancelá-la.
7. Resultado esperado: cancelamento bloqueado.

Os cenários que exigem preparação direta de dados já são cobertos pelas suítes
automatizadas do backend e não devem ser executados em um banco de produção.

### Comanda com pedido entregue

1. Crie um pedido e avance até Entregue.
2. Tente cancelar a comanda.
3. Resultado esperado: cancelamento bloqueado.
4. Pague o valor exato e feche a comanda.
5. Resultado esperado: fechamento permitido e mesa Livre.

### Categoria inativa

1. Desative uma categoria que possua produto ativo.
2. Tente criar um novo pedido com esse produto pela API.
3. Resultado esperado: venda bloqueada sem alterar pedidos antigos.

### Cozinha

1. Tente avançar um status fora da sequência pela API.
2. Tente cancelar um pedido entregue.
3. Resultado esperado: erro de negócio em JSON.

## Rotas e responsividade

- Recarregue `/mesas` e confirme que a tela permanece em Mesas.
- Acesse uma rota inexistente e confirme redirecionamento para `/dashboard`.
- Recolha e expanda a sidebar várias vezes.
- Confirme ausência de scroll horizontal e scrollbar duplicada.
- Teste em largura menor que 720px.
- Abra um formulário modal, confirme o foco inicial e pressione `Escape`.
- Alterne entre os temas dark e light e recarregue a página.
