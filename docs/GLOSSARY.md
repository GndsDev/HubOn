# Glossário oficial do HubOn

Este glossário define os principais termos usados no produto, na documentação e nas discussões de evolução do HubOn.

## Termos

### Pedido

Registro de uma solicitação feita pelo cliente, contendo um ou mais produtos e seguindo um fluxo operacional até preparo, entrega, cancelamento ou conclusão.

### Comanda

Conta operacional vinculada a uma mesa ou atendimento, usada para agrupar pedidos e pagamentos até o fechamento.

### Produto

Item vendido ao cliente, como refeição, bebida, adicional ou serviço cadastrado no cardápio.

### Receita

Composição planejada de um produto a partir de ingredientes ou insumos. Termo
fora do escopo implementado no estoque atual.

### Ficha Técnica

Descrição detalhada da receita de um produto. Termo fora do escopo implementado
no estoque atual.

### Ingrediente

Item usado na preparação de um produto, normalmente consumido a partir do estoque.

### Insumo

Item controlado pelo estoque, podendo ser ingrediente, embalagem, descartável ou outro recurso necessário para venda ou operação.

### Movimentação

Registro de entrada, saída, ajuste, perda, compra ou estorno que altera ou justifica alteração no saldo de estoque.

### Fornecedor

Pessoa ou empresa que fornece produtos, ingredientes, embalagens ou outros insumos para a operação.

### Compra

Entrada planejada ou registrada de itens adquiridos de fornecedor para abastecer o estoque.

### Estoque

Conjunto de insumos disponíveis para uso, venda, preparo ou reposição dentro da operação.

### Saldo

Quantidade atual de um item em estoque, calculada a partir das movimentações registradas.

### Baixa

Redução de saldo causada por consumo, venda, preparo, perda ou ajuste.

### Ajuste

Movimentação manual usada para corrigir saldo de estoque com justificativa.

### Perda

Movimentação que registra descarte, vencimento, dano ou desperdício de um item de estoque.

### Capacidade de Produção

Quantidade estimada de produtos que ainda podem ser preparados. Fora do escopo
implementado no estoque atual.

### Fluxo de Caixa

Acompanhamento das entradas e saídas financeiras da operação em determinado período.

### Turno de Caixa

Período persistido entre abertura e fechamento, com saldo inicial, recebimentos,
sangrias, suprimentos, conferência e diferença.

### Dashboard

Tela de visão geral com indicadores operacionais, financeiros ou administrativos do sistema.

### Owner

Perfil com maior nível de permissão, responsável pela administração completa da operação e das configurações principais.

### Admin

Perfil administrativo com permissão para gerenciar cadastros, operação e partes relevantes do sistema, respeitando limites definidos pelo Owner.

### Waiter

Perfil de atendimento, voltado à operação de salão, mesas, comandas e pedidos.

### Kitchen

Perfil legado de preparo. Quando utilizado, acessa uma versão filtrada de Pedidos
e pode somente marcar itens preparados como prontos.

### Cashier

Perfil operacional que atende Balcão e Comandas e controla o turno financeiro do
Caixa dentro das permissões definidas.

### JWT

Token usado para autenticar a sessão do usuário e permitir acesso às rotas protegidas da API.

### ADR

Architecture Decision Record; documento curto usado para registrar uma decisão arquitetural relevante, seu contexto, alternativas e consequências.

