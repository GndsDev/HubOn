# Roteiro de homologação

Use dados fictícios e execute em tema claro e escuro, prioritariamente em desktop.

## Acesso e navegação

- [ ] Login aceita nome de usuário com normalização de espaços e caixa.
- [ ] Usuário inativo não entra.
- [ ] Menu contém Dashboard, Comandas, Histórico, Balcão, Caixa, Relatórios,
  Categorias, Produtos, Estoque e Usuários.
- [ ] Minha Conta exibe dados e troca a senha encerrando a sessão.

## Comandas

- [ ] Abrir comanda com número positivo.
- [ ] Impedir segunda comanda aberta para o mesmo número.
- [ ] Adicionar produto simples com um clique.
- [ ] Exigir escolhas configuradas e calcular adicionais.
- [ ] Alterar quantidade sem recarregar a página.
- [ ] Remover item sem pedir motivo e verificar reversão do estoque.
- [ ] Cancelar item com motivo e verificar auditoria.
- [ ] Registrar pagamento parcial e bloquear alterações dos itens.
- [ ] Quitar e fechar explicitamente a comanda.
- [ ] Confirmar que o número pode ser usado novamente.

## Balcão

- [ ] Criar venda e adicionar itens rapidamente.
- [ ] Pesquisar produtos enquanto digita e filtrar por categoria.
- [ ] Registrar pagamento integral positivo e confirmar fechamento automático.
- [ ] Manter venda aberta após pagamento parcial.
- [ ] Finalizar explicitamente venda de total zero com item ativo.
- [ ] Impedir pagamento ou fechamento de venda vazia.

## Catálogo e estoque

- [ ] Criar produto sem categoria e vendê-lo.
- [ ] Alterar disponibilidade e atividade.
- [ ] Configurar grupo com limites válidos e escolhas.
- [ ] Criar item de estoque e registrar entrada, saída, perda e ajuste.
- [ ] Verificar alertas de saldo mínimo/zerado.
- [ ] Configurar baixa automática de produto e de escolha.
- [ ] Conferir `SALE` na inclusão e `SALE_REVERSAL` na redução, remoção ou
  cancelamento.

## Caixa

- [ ] Abrir turno com saldo inicial.
- [ ] Impedir segundo turno aberto.
- [ ] Confirmar que pagamentos entram no extrato e no método correto.
- [ ] Registrar suprimento e sangria com observação.
- [ ] Conferir o dinheiro esperado.
- [ ] Exigir observação para diferença de fechamento.
- [ ] Consultar o turno no histórico.

## Histórico e relatórios

- [ ] Filtrar histórico por período, origem e situação.
- [ ] Abrir detalhes com itens, escolhas e pagamentos.
- [ ] Consultar relatórios diário, mensal e anual.
- [ ] Filtrar por Todas, Comandas e Balcão.
- [ ] Confirmar que remoções não aparecem como cancelamentos.
- [ ] Abrir o menu de exportação e validar CSV, XLSX e PDF.

## Qualidade visual

- [ ] Sem erros HTTP, loading permanente, texto sobreposto ou overflow.
- [ ] Ícones, foco, contraste e estados desabilitados permanecem legíveis.
- [ ] Dialogs fecham por botão e `Esc`, com foco controlado.
- [ ] Menus e overlays ficam dentro da viewport.
