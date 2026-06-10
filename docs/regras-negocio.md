# Regras de negócio do HubOn MVP

## Categorias e produtos

- Categoria exige nome e pode ser ativada ou desativada sem apagar histórico.
- Produto exige nome, categoria e preço maior ou igual a zero.
- Produto inativo não pode entrar em um novo pedido.
- Alterar nome ou preço de produto não muda itens antigos.
- Cada item congela `productNameSnapshot` e `unitPriceSnapshot`.
- Quantidade deve ser maior que zero.
- Subtotal é `unitPriceSnapshot * quantity`.

## Mesas

- Número é obrigatório e único.
- Status disponíveis: `AVAILABLE`, `OCCUPIED`, `RESERVED` e `DISABLED`.
- Na interface: Livre, Ocupada, Reservada e Desativada.
- `active=false` é tratado como `DISABLED`.
- `DISABLED` sempre grava `active=false`.
- Qualquer outro status grava `active=true`.
- Mesa reservada não abre comanda diretamente no MVP.
- Mesa desativada não abre comanda.
- Mesa ocupada ou com comanda aberta não pode ser desativada.
- Não há exclusão definitiva de mesa.

## Comandas

- Uma mesa não pode ter mais de uma comanda aberta.
- Somente mesa livre e ativa pode abrir comanda.
- Ao abrir, a mesa muda para `OCCUPIED`.
- Comanda fechada ou cancelada não recebe pedidos nem pagamentos.
- Uma comanda não pode ser fechada ou cancelada enquanto possuir pedidos pendentes.
- Cancelar uma comanda devolve a mesa para `AVAILABLE`.
- Fechar exige saldo restante igual a zero.
- Ao fechar, a mesa volta para `AVAILABLE`.

## Pedidos e cozinha

- Pedido pertence a uma comanda aberta e começa como `CREATED`.
- `CREATED` pode avançar para `SENT_TO_KITCHEN`.
- A cozinha segue somente esta sequência:
  `SENT_TO_KITCHEN` → `PREPARING` → `READY` → `DELIVERED`.
- Transições fora dessa sequência são rejeitadas.
- Pedido entregue não pode ser cancelado.
- Um pedido pendente ligado a uma comanda cancelada pode apenas ser cancelado, permitindo regularizar dados antigos sem avançar a produção.
- Pedido ligado a uma comanda fechada não pode ser alterado.
- Pedido cancelado não entra no total da comanda.
- Um pedido possui um ou mais itens.

## Pagamentos e totais

- Pagamento exige método e valor maior que zero.
- Pagamento pertence a uma comanda aberta.
- A soma paga não pode ultrapassar `finalAmount`.
- `totalAmount` soma itens ativos de pedidos não cancelados.
- `finalAmount = totalAmount + serviceFee - discountAmount`, limitado a zero.
- `remainingAmount = finalAmount - paidAmount`, limitado a zero.
- A consulta de pagamentos retorna total, pago, restante e histórico.

## Segurança e persistência

- Endpoints estão liberados apenas para desenvolvimento local.
- CSRF está desabilitado e CORS aceita hosts locais do frontend.
- Não há JWT nem autorização por perfil.
- Flyway controla o esquema.
- `spring.jpa.hibernate.ddl-auto=validate` permanece obrigatório.
