# Fluxo de teste manual

## Preparação

1. Inicie o PostgreSQL e confirme o banco `hubon_db`.
2. No diretório `backend`, execute `.\mvnw.cmd spring-boot:run`.
3. No diretório `frontend`, execute `npm start` e abra `http://localhost:4200`.

## Fluxo principal

4. Em **Categorias**, crie uma categoria ativa.
5. Em **Produtos**, crie um produto ativo para a categoria.
6. Em **Mesas**, crie uma mesa com status `Livre`.
7. Clique na mesa livre e abra uma comanda escolhendo um usuário.
8. Em **Pedidos**, crie um pedido para a comanda e adicione o produto.
9. Envie o pedido para a cozinha.
10. Em **Cozinha**, mova o pedido para `Preparando`.
11. Mova o pedido para `Pronto`.
12. Marque o pedido como `Entregue`.
13. Em **Caixa**, selecione a comanda e registre o pagamento do valor restante.
14. Feche a comanda depois que o restante chegar a zero.
15. Volte para **Mesas** e confirme que a mesa está `Livre`.

## Validações recomendadas

- Tente abrir duas comandas para a mesma mesa.
- Tente vender um produto inativo.
- Tente pagar valor zero ou maior que o restante.
- Tente fechar uma comanda com saldo.
- Desligue o backend e confirme a mensagem amigável de conexão.
