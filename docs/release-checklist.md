# Checklist de release

Use esta lista antes de criar uma versão do HubOn.

## Código e banco

- [ ] Backend compila.
- [ ] `.\mvnw.cmd test` passa.
- [ ] Flyway valida todas as migrations.
- [ ] `ddl-auto` permanece como `validate`.
- [ ] Nenhuma migration aplicada foi reescrita.
- [ ] Não existem credenciais reais versionadas.

## Frontend

- [ ] `npm install` conclui sem erro.
- [ ] `npm test -- --watch=false` passa em ambiente local.
- [ ] `npm run build` passa.
- [ ] Rotas diretas e recarga funcionam.
- [ ] Rota desconhecida redireciona para Dashboard.
- [ ] Sidebar desktop e drawer mobile funcionam.
- [ ] Tema dark e light estão legíveis.
- [ ] Branding e logo estão corretos.
- [ ] Favicon aparece após recarga sem cache.
- [ ] Não existem botões principais sem ação.
- [ ] Recursos futuros estão desabilitados ou marcados como “em breve”.
- [ ] Não existem mocks silenciosos nos módulos operacionais.

## Fluxo operacional

- [ ] Operador pode ser selecionado.
- [ ] Mesa livre abre uma comanda.
- [ ] Mesa ocupada não abre segunda comanda.
- [ ] Pedido é criado com produto ativo.
- [ ] Cozinha percorre a sequência válida.
- [ ] Pedido entregue não pode ser cancelado.
- [ ] Pagamento válido reduz o saldo.
- [ ] Pagamento zero ou excedente é rejeitado.
- [ ] Comanda só fecha com saldo zero.
- [ ] Mesa volta para Livre após fechamento.

## Casos negativos

- [ ] Mesa reservada não abre comanda diretamente.
- [ ] Mesa desativada não abre comanda.
- [ ] Produto ou categoria inativa bloqueia nova venda.
- [ ] Pedido não é cancelado após pagamento da comanda.
- [ ] Comanda com pagamento não é cancelada.
- [ ] Comanda com pedido entregue não é cancelada.
- [ ] Pagamentos concorrentes não excedem o valor final.

## Qualidade

- [ ] Modais principais fecham com `Escape`.
- [ ] Foco inicial e restauração de foco funcionam.
- [ ] Botões de ícone possuem nome acessível.
- [ ] Layout não apresenta rolagem horizontal inesperada.
- [ ] Estados de loading, erro e vazio são compreensíveis.
- [ ] Console do navegador não apresenta erros inesperados.
- [ ] API não registra exceções inesperadas durante o roteiro manual.

## Documentação e entrega

- [ ] README está atualizado.
- [ ] Endpoints estão atualizados.
- [ ] Regras de negócio estão atualizadas.
- [ ] Status do MVP corresponde ao que foi entregue.
- [ ] Roteiro manual foi executado.
- [ ] Notas de segurança foram revisadas.
- [ ] Alterações da versão foram resumidas.
- [ ] Tag de release foi criada.

