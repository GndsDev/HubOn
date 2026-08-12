# Status atual do HubOn

## Entregue

- autenticação por nome de usuário, JWT e troca de senha;
- acesso operacional para Dono e Gerente;
- Dashboard com resumo do dia e do caixa;
- Comandas por número de mesa e vendas de Balcão;
- inclusão rápida de produtos e escolhas obrigatórias quando configuradas;
- alteração de quantidade, remoção e cancelamento auditável de itens;
- pagamentos parciais e múltiplas formas de recebimento;
- abertura, movimentação, conferência e histórico de caixa;
- catálogo com categorias opcionais, produtos e escolhas;
- estoque com movimentos manuais e baixas automáticas por produto ou escolha;
- Histórico de vendas;
- relatórios diário, mensal e anual por origem;
- exportação CSV, XLSX e PDF;
- temas claro e escuro;
- stack Docker local, instalador e inicialização automática no Windows;
- testes automatizados de backend e frontend e auditoria visual documental.

## Limitações conhecidas

- operação pensada para uma instalação local e equipe administrativa pequena;
- sem recuperação de senha ou refresh token;
- sem estorno financeiro: venda com pagamento não pode ser cancelada;
- sem edição administrativa de usuários existentes pela API atual;
- sem paginação nos principais endpoints de listagem;
- sem impressão operacional integrada;
- controle de estoque automático simples, sem ficha técnica ou compras.

## Fora do escopo atual

- atendimento externo ao sistema;
- delivery e integrações com marketplaces;
- fornecedores, compras e produção;
- múltiplas filiais;
- aplicação pública para clientes.
