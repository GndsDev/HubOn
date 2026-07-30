# Regras de negócio do HubOn MVP

As regras abaixo descrevem o que está implementado no MVP. As regras de estoque
híbrido, baixa automática simples, saldo negativo e estorno estão separadas em
[stock-management.md](stock-management.md).

## Categorias e produtos

- Categoria exige nome e pode ser ativada ou desativada sem apagar histórico.
- Produto base exige nome, categoria e fluxo de preparo.
- O nome do produto deve ser único dentro da categoria, ignorando maiúsculas e
  minúsculas.
- O preço pertence a `ProductVariant`, não ao produto base.
- Variação exige nome e preço maior ou igual a zero.
- O nome da variação deve ser único dentro do produto, ignorando maiúsculas e
  minúsculas.
- Produto só pode ser vendido quando possui ao menos uma variação ativa e disponível.
- Produto inativo ou indisponível não pode entrar em um novo pedido.
- Produto pertencente a uma categoria inativa não pode entrar em um novo pedido.
- Variação inativa ou indisponível não pode entrar em um novo pedido.
- Alterar nome ou preço de produto/variação não muda itens antigos.
- Cada item congela `productNameSnapshot`, `productVariantNameSnapshot` e
  `unitPriceSnapshot`.
- Quantidade deve ser maior que zero.
- Subtotal e `unitPriceSnapshot * quantity`.

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

- Pedido pertence a uma comanda aberta, começa como `CREATED` e seus itens como `DRAFT`.
- A confirmação envia itens `REQUIRES_PREPARATION` para `WAITING_PREPARATION`.
- Itens `DIRECT_SERVICE` não entram na fila e ficam `READY` imediatamente.
- Pedido composto somente por itens `DIRECT_SERVICE` fica `READY`.
- A fila segue por item: `WAITING_PREPARATION` -> `IN_PREPARATION` -> `READY`.
- Transições fora dessa sequência são rejeitadas.
- Pedido entregue não pode ser cancelado.
- Pedido não pode ser cancelado se sua comanda já possui pagamento registrado.
- Um pedido pendente ligado a uma comanda cancelada pode apenas ser cancelado,
  permitindo regularizar dados antigos sem avançar a produção.
- Pedido ligado a uma comanda fechada não pode ser alterado.
- Pedido cancelado não entra no total da comanda.
- Um pedido possui um ou mais itens.
- Cancelamento por item não faz parte do MVP; `OrderItemStatus.CANCELLED` fica
  reservado para evolução futura.

## Pagamentos e totais

- Pagamento exige método e valor maior que zero.
- Pagamento pertence a uma comanda aberta.
- A soma paga não pode ultrapassar `finalAmount`.
- Pagamento maior que o saldo restante é rejeitado.
- Pagamento excedente já existente impede o fechamento da comanda.
- Registro de pagamento e fechamento obtêm lock pessimista da comanda.
- Pagamentos concorrentes são serializados; somente valores compatíveis com o
  saldo atualizado são aceitos.
- Em conflito de lock, a API retorna erro para recarregar os dados e tentar
  novamente.
- `totalAmount` soma itens ativos de pedidos não cancelados.
- `finalAmount = totalAmount + serviceFee - discountAmount`, limitado a zero.
- `remainingAmount = finalAmount - paidAmount`, limitado a zero.
- A consulta de pagamentos retorna total, pago, restante e histórico.

## Segurança e persistência

- Endpoints operacionais exigem JWT válido.
- Autorização é definida por perfil no backend.
- O frontend apenas oculta ações indisponíveis; não é fonte de segurança.
- Entidades históricas usam desativação quando há impacto em auditoria.
- Alterações financeiras, de comanda, pedidos e estoque usam transação.

## Venda no balcão

- Cada atendimento cria imediatamente uma comanda `COUNTER` própria e sem mesa.
- A comanda permanece na central do Balcão até ser finalizada ou cancelada.
- Itens, quantidades, variações, escolhas e observações do rascunho são persistidos no backend.
- O backend deriva o canal do pedido a partir da comanda.
- Pagamento pode terminar antes do preparo; cozinha e financeiro permanecem estados independentes.
- A entrega exige todos os itens ativos prontos, e o fechamento exige entrega ou cancelamento operacional e pagamento exato.
- Nome, telefone e referência são opcionais.
- `OWNER`, `ADMIN` e `CASHIER` operam o Balcão; `WAITER` não recebe acesso implícito.

## Relatório mensal

- A competência é a data comercial de fechamento no fuso configurado.
- Somente comandas fechadas com item vendido válido entram em receita e quantidades.
- Rascunhos e cancelamentos são excluídos das vendas e apresentados separadamente quando aplicável.
- Snapshots protegem nomes, categorias, variações e preços históricos.
