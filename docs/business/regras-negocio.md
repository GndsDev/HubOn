# Regras de negocio do HubOn MVP

As regras abaixo descrevem o que esta implementado no MVP. As regras de estoque
hibrido, baixa automatica simples, saldo negativo e estorno estao separadas em
[stock-management.md](stock-management.md).

## Categorias e produtos

- Categoria exige nome e pode ser ativada ou desativada sem apagar historico.
- Produto base exige nome, categoria e fluxo de preparo.
- O nome do produto deve ser unico dentro da categoria, ignorando maiusculas e
  minusculas.
- O preco pertence a `ProductVariant`, nao ao produto base.
- Variacao exige nome e preco maior ou igual a zero.
- O nome da variacao deve ser unico dentro do produto, ignorando maiusculas e
  minusculas.
- Produto so pode ser vendido quando possui ao menos uma variacao ativa.
- Produto inativo nao pode entrar em um novo pedido.
- Produto pertencente a uma categoria inativa nao pode entrar em um novo pedido.
- Variacao inativa nao pode entrar em um novo pedido.
- Alterar nome ou preco de produto/variacao nao muda itens antigos.
- Cada item congela `productNameSnapshot`, `productVariantNameSnapshot` e
  `unitPriceSnapshot`.
- Quantidade deve ser maior que zero.
- Subtotal e `unitPriceSnapshot * quantity`.

## Mesas

- Numero e obrigatorio e unico.
- Status disponiveis: `AVAILABLE`, `OCCUPIED`, `RESERVED` e `DISABLED`.
- Na interface: Livre, Ocupada, Reservada e Desativada.
- Cadastro e edicao manual permitem apenas `AVAILABLE`, `RESERVED` e `DISABLED`.
- `OCCUPIED` e controlado exclusivamente pelo ciclo da comanda.
- `active=false` e tratado como `DISABLED`.
- `DISABLED` sempre grava `active=false`.
- Qualquer outro status grava `active=true`.
- Mesa reservada nao abre comanda diretamente no MVP.
- Mesa desativada nao abre comanda.
- Mesa ocupada ou com comanda aberta nao pode ser desativada.
- Nao ha exclusao definitiva de mesa.

## Comandas

- Uma mesa nao pode ter mais de uma comanda aberta.
- Somente mesa livre e ativa pode abrir comanda.
- Mesa `RESERVED` nao pode abrir comanda diretamente no MVP.
- Ao abrir, a mesa muda para `OCCUPIED`.
- Comanda fechada ou cancelada nao recebe pedidos nem pagamentos.
- Uma comanda nao pode ser fechada ou cancelada enquanto possuir pedidos pendentes.
- Comanda com qualquer pagamento registrado nao pode ser cancelada.
- Comanda com pedido entregue nao pode ser cancelada.
- Cancelar uma comanda devolve a mesa para `AVAILABLE`.
- Fechar exige que o valor pago seja exatamente igual ao `finalAmount`.
- Pagamento incompleto ou excedente impede o fechamento.
- Ao fechar, a mesa volta para `AVAILABLE`.

## Pedidos e cozinha

- Pedido pertence a uma comanda aberta e comeca como `CREATED`.
- Itens `KITCHEN` podem avancar de `CREATED` para `SENT_TO_KITCHEN`.
- Itens `DIRECT_SERVICE` nao entram na cozinha e ficam prontos imediatamente.
- Pedido composto somente por itens `DIRECT_SERVICE` pode ir direto para `READY`.
- A cozinha segue somente esta sequencia:
  `SENT_TO_KITCHEN` -> `PREPARING` -> `READY` -> `DELIVERED`.
- Transicoes fora dessa sequencia sao rejeitadas.
- Pedido entregue nao pode ser cancelado.
- Pedido nao pode ser cancelado se sua comanda ja possui pagamento registrado.
- Um pedido pendente ligado a uma comanda cancelada pode apenas ser cancelado,
  permitindo regularizar dados antigos sem avancar a producao.
- Pedido ligado a uma comanda fechada nao pode ser alterado.
- Pedido cancelado nao entra no total da comanda.
- Um pedido possui um ou mais itens.
- Cancelamento por item nao faz parte do MVP; `OrderItemStatus.CANCELLED` fica
  reservado para evolucao futura.

## Pagamentos e totais

- Pagamento exige metodo e valor maior que zero.
- Pagamento pertence a uma comanda aberta.
- A soma paga nao pode ultrapassar `finalAmount`.
- Pagamento maior que o saldo restante e rejeitado.
- Pagamento excedente ja existente impede o fechamento da comanda.
- Registro de pagamento e fechamento obtem lock pessimista da comanda.
- Pagamentos concorrentes sao serializados; somente valores compativeis com o
  saldo atualizado sao aceitos.
- Em conflito de lock, a API retorna erro para recarregar os dados e tentar
  novamente.
- `totalAmount` soma itens ativos de pedidos nao cancelados.
- `finalAmount = totalAmount + serviceFee - discountAmount`, limitado a zero.
- `remainingAmount = finalAmount - paidAmount`, limitado a zero.
- A consulta de pagamentos retorna total, pago, restante e historico.

## Seguranca e persistencia

- Endpoints operacionais exigem JWT valido.
- Autorizacao e definida por perfil no backend.
- O frontend apenas oculta acoes indisponiveis; nao e fonte de seguranca.
- Entidades historicas usam desativacao quando ha impacto em auditoria.
- Alteracoes financeiras, de comanda, pedidos e estoque usam transacao.
