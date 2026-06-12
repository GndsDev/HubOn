# Regras de negócio do HubOn MVP

## Categorias e produtos

- Categoria exige nome e pode ser ativada ou desativada sem apagar histórico.
- Produto exige nome, categoria e preço maior ou igual a zero.
- Produto inativo não pode entrar em um novo pedido.
- Produto pertencente a uma categoria inativa não pode entrar em um novo pedido.
- Alterar nome ou preço de produto não muda itens antigos.
- Cada item congela `productNameSnapshot` e `unitPriceSnapshot`.
- Quantidade deve ser maior que zero.
- Subtotal é `unitPriceSnapshot * quantity`.

## Mesas

- Número é obrigatório e único.
- Status disponíveis: `AVAILABLE`, `OCCUPIED`, `RESERVED` e `DISABLED`.
- Na interface: Livre, Ocupada, Reservada e Desativada.
- Cadastro e edição manual permitem apenas `AVAILABLE`, `RESERVED` e `DISABLED`.
- `OCCUPIED` é controlado exclusivamente pelo ciclo da comanda.
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
- Mesa `RESERVED` não pode abrir comanda diretamente no MVP.
- Ao abrir, a mesa muda para `OCCUPIED`.
- Comanda fechada ou cancelada não recebe pedidos nem pagamentos.
- Uma comanda não pode ser fechada ou cancelada enquanto possuir pedidos pendentes.
- Comanda com qualquer pagamento registrado não pode ser cancelada.
- Comanda com pedido entregue não pode ser cancelada.
- Cancelar uma comanda devolve a mesa para `AVAILABLE`.
- Fechar exige que o valor pago seja exatamente igual ao `finalAmount`.
- Pagamento incompleto ou excedente impede o fechamento.
- Ao fechar, a mesa volta para `AVAILABLE`.

## Pedidos e cozinha

- Pedido pertence a uma comanda aberta e começa como `CREATED`.
- `CREATED` pode avançar para `SENT_TO_KITCHEN`.
- A cozinha segue somente esta sequência:
  `SENT_TO_KITCHEN` → `PREPARING` → `READY` → `DELIVERED`.
- Transições fora dessa sequência são rejeitadas.
- Pedido entregue não pode ser cancelado.
- Pedido não pode ser cancelado se sua comanda já possui pagamento registrado.
- Um pedido pendente ligado a uma comanda cancelada pode apenas ser cancelado, permitindo regularizar dados antigos sem avançar a produção.
- Pedido ligado a uma comanda fechada não pode ser alterado.
- Pedido cancelado não entra no total da comanda.
- Um pedido possui um ou mais itens.
- Cancelamento por item não faz parte do MVP; `OrderItemStatus.CANCELLED` fica reservado para evolução futura.

## Pagamentos e totais

- Pagamento exige método e valor maior que zero.
- Pagamento pertence a uma comanda aberta.
- A soma paga não pode ultrapassar `finalAmount`.
- Pagamento maior que o saldo restante é rejeitado.
- Pagamento excedente já existente impede o fechamento da comanda.
- Registro de pagamento e fechamento obtêm lock pessimista da comanda.
- Pagamentos concorrentes são serializados; somente valores compatíveis com o saldo atualizado são aceitos.
- Em conflito de lock, a API retorna erro para recarregar os dados e tentar novamente.
- `totalAmount` soma itens ativos de pedidos não cancelados.
- `finalAmount = totalAmount + serviceFee - discountAmount`, limitado a zero.
- `remainingAmount = finalAmount - paidAmount`, limitado a zero.
- A consulta de pagamentos retorna total, pago, restante e histórico.

## Segurança e persistência

- Endpoints estão liberados apenas para desenvolvimento local.
- O operador ativo é selecionado na topbar e persistido localmente no navegador.
- Abrir comanda, criar pedido e registrar pagamento exigem operador selecionado.
- O contexto local de operador é provisório e não substitui autenticação.
- CSRF está desabilitado e CORS aceita hosts locais do frontend.
- Não há JWT nem autorização por perfil.
- Flyway controla o esquema.
- `spring.jpa.hibernate.ddl-auto=validate` permanece obrigatório.
- Open Session in View permanece desativado.
- O perfil local é liberado somente para desenvolvimento em rede confiável.
- O perfil de produção bloqueia endpoints até existir configuração de segurança real.
