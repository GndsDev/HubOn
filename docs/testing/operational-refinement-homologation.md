# Homologação do refinamento estrutural

Data da validação: 31/07/2026.

## Resultado

O refinamento reorganizou Produtos, Balcão, Comandas, Pedidos e Caixa sem
remover regras já existentes de catálogo, escolhas, snapshots, estoque,
estornos, pagamentos, mesas, relatório mensal ou autorização. O frontend e o
backend foram executados antes das alterações, o problema visual fornecido foi
reproduzido e os fluxos foram comparados com o estado final.

Responsabilidades consolidadas:

| Área | Responsabilidade |
| --- | --- |
| Balcão | Abrir, montar, confirmar, receber, acompanhar, entregar e finalizar vendas `COUNTER`. |
| Comandas | Atender e receber vendas de mesas dentro da própria comanda. |
| Pedidos | Acompanhar itens e executar ações de preparo e entrega. |
| Caixa | Controlar turno, dinheiro, movimentações e conferência. |
| Relatórios | Analisar resultados sem executar operações de venda. |

## Diagnóstico e correção de Produtos

### Causa

O formulário de variação e a lista compartilhavam a mesma região visual. O
painel lateral ocupava espaço sobre a linha, enquanto a própria linha mantinha
larguras mínimas incompatíveis com a coluna disponível. Por isso os botões
continuavam no DOM, mas ficavam atrás dos campos mostrados na imagem de
referência. Não era uma falha de `z-index`; era uma disputa estrutural por
largura e área de layout.

Durante a auditoria em 1920x1080 também foi encontrada uma segunda manifestação:
as colunas mínimas da linha podiam ultrapassar a trilha esquerda do grid e
invadir o editor. A grade da linha foi ajustada para manter ações e dados dentro
da própria coluna.

### Estrutura final

- O gerenciador mantém cabeçalho, abas e rodapé estáveis, com conteúdo interno
  rolável e altura limitada pela viewport.
- Em notebooks, a lista aparece primeiro e o formulário em largura total logo
  abaixo.
- Em telas realmente largas, lista e formulário ocupam duas colunas reais com
  `minmax(0, 1fr)` e uma coluna de edição limitada.
- Criar e editar usam o mesmo formulário, sem abrir outro modal principal.
- O formulário contém Nome, Preço, SKU, Ordem, Ativa, Disponível e vínculo de
  estoque opcional. O rodapé oferece apenas Cancelar e Salvar variação.
- **Editar variação** é a ação principal com texto. Vincular, alterar ou remover
  estoque, disponibilizar, indisponibilizar, ativar e desativar ficam no menu de
  três pontos.
- Menus usam o portal global, calculam sua posição na viewport e abrem acima
  quando necessário. Foco, teclado, `Escape`, tooltip e `aria-label` foram
  preservados.

Em 1366x768 e 1366x650, a aba permanece em uma coluna, não produz rolagem
horizontal, mantém o rodapé alcançável e não sobrepõe botões, campos ou linhas.

## Balcão persistente

### Causa da perda aparente

A operação dependia demais do contexto da tela, e o Caixa funcionava como ponto
alternativo de localização e recebimento. Isso tornava a troca de rota ambígua:
a venda existia no backend, mas não era apresentada como atendimento ativo com
continuidade e próxima ação claras.

### Experiência final

- **Nova venda no balcão** cria imediatamente uma comanda `COUNTER` no backend.
- A central separa atendimentos ativos, estados operacionais e finalizados.
- A rota `/balcao/:id` recarrega itens, escolhas, observações, valores pagos e
  estados diretamente da API após navegação ou atualização do navegador.
- Atendimento, financeiro e preparo são mostrados separadamente, sem persistir
  um estado redundante de "aguardando pagamento".
- A interface mostra a próxima ação contextual: confirmar, registrar ou
  completar pagamento, marcar item pronto, entregar e finalizar.
- A ação manual **Iniciar preparo** foi removida.

O Caixa deixou de ser necessário para localizar ou concluir uma venda de
balcão. Ele pode apontar para a origem da operação, mas não abre um formulário
concorrente de pagamento.

## Pagamento e preparo

`PaymentDialogComponent` e `PaymentApiService` formam a interface reutilizável
de pagamento em Balcão e Comandas. `PaymentService` é a autoridade única para
saldo, excesso, método, autoria, associação ao turno e integração com preparo.
Pedidos e Caixa não possuem cópias desse formulário.

Para `COUNTER`, o pagamento integral e o início do preparo elegível acontecem na
mesma transação:

1. O pagamento é validado e registrado.
2. O saldo é recalculado com bloqueio concorrente.
3. Ao chegar a zero, itens `REQUIRES_PREPARATION` elegíveis passam para
   `IN_PREPARATION`.
4. Itens `DIRECT_SERVICE` permanecem prontos para entrega.
5. Estados e próxima ação são recalculados e devolvidos ao frontend.

Pagamento parcial mantém itens preparados em **Aguardando pagamento**. Itens
cancelados, prontos, entregues ou já em preparo não regridem. Em venda mista, o
item direto continua pronto e apenas o item preparado é iniciado. Uma falha na
transição de preparo desfaz o pagamento inteiro. Repetições são idempotentes.
Chamadas diretas à API também não conseguem iniciar manualmente o preparo de
`COUNTER` nem entregar seus itens antes da quitação integral.

O comportamento de `TABLE` não recebeu essa automação: mesas preservam o fluxo
existente e o pagamento ocorre dentro da comanda.

## Pedidos, Cozinha e KITCHEN

Pedidos agora concentra filtros por estado e origem, mostra estados individuais
e permite somente **Marcar como pronto** ou **Marcar como entregue** quando a
regra autoriza. Vendas `COUNTER` direcionam para o Balcão e mesas para a
Comanda. Não existem pagamento completo, **Iniciar preparo**, **Enviar para
cozinha** ou avanço genérico de pedido nessa tela.

A tela Cozinha foi removida da sidebar, Dashboard e navegação visível. A URL
legada `/cozinha` redireciona para `/pedidos`, evitando link quebrado. Entidades,
estados e endpoints de domínio foram mantidos no backend por compatibilidade.

O perfil `KITCHEN` continua disponível, mas recebe uma versão filtrada de
Pedidos: somente itens de preparo, origem, estado e **Marcar como pronto**. Esse
perfil não vê preços, pagamentos, Caixa, catálogo, estoque ou itens diretos, e
não pode confirmar, iniciar preparo, entregar, finalizar ou cancelar.

## Caixa, Dashboard e navegação

O Caixa passou a representar um turno financeiro persistido. Quando fechado,
oferece abertura com saldo inicial. Quando aberto, mostra operador, horário,
recebimentos por método, sangrias, suprimentos, saldo esperado, movimentações e
ações de fechar, registrar sangria ou suprimento. O fechamento registra valor
contado, diferença e exige observação em divergências. Nenhuma ação financeira
altera preparo, entrega ou fechamento de atendimento.

Pagamentos entram automaticamente no turno aberto por meio de uma associação
explícita. Referências pendentes direcionam para Balcão ou Comanda. O Caixa não
monta pedidos, recebe clientes nem duplica pagamento.

Dashboard e sidebar foram reorganizados pelas responsabilidades operacionais,
financeiras, de cardápio e gestão. Indicadores direcionam para Balcão, Pedidos,
Estoque ou Caixa. Todas as referências exclusivas à antiga tela Cozinha foram
retiradas.

## Interface e textos

Foram revisados Dashboard, Mesas, Comandas, Pedidos, Balcão, Caixa, Categorias,
Produtos, Estoque, Relatório mensal, Usuários, Login e Minha Conta. Espaçamentos,
cards, filtros, tabelas, formulários, badges, estados vazios, foco e contraste
seguem os tokens e temas existentes. Pedidos ganhou quebra responsiva de filtros
e ações para impedir cortes em 1366 e 1440 pixels.

Rótulos visíveis e CSV receberam acentuação em português, incluindo Variações,
Preço, Informações, Disponível, Observação, Usuário, Relatório, Cardápio,
Produção, Mês e Receita líquida. Identificadores, enums, contratos JSON e nomes
de banco permaneceram intactos.

## Banco e backend

A migration `V8__cash_shifts_and_movements.sql` cria `cash_shifts` e
`cash_movements`, garante apenas um turno aberto, associa pagamentos ao turno de
forma opcional e adiciona índices de consulta. Ela não altera dados históricos
nem as migrations V1 a V7. O vínculo opcional em pagamentos mantém
compatibilidade com registros anteriores.

O backend ganhou o módulo `cash`, a resposta operacional de pagamento e o
`OrderPreparationWorkflowService`. Repositórios de pedidos passaram a localizar
e bloquear os itens elegíveis necessários para a transação atômica. Segurança e
autorização foram ajustadas para turno financeiro, fila filtrada e transições
por item.

## Arquivos criados

- `backend/src/main/java/com/hubon/backend/cash/`: controller, serviço,
  entidades, enums, DTOs e repositórios do turno.
- `backend/src/main/java/com/hubon/backend/order/service/OrderPreparationWorkflowService.java`.
- `backend/src/main/java/com/hubon/backend/payment/dto/PaymentFinancialState.java`.
- `backend/src/main/java/com/hubon/backend/payment/dto/PaymentNextAction.java`.
- `backend/src/main/java/com/hubon/backend/payment/dto/PaymentOperationResponse.java`.
- `backend/src/main/resources/db/migration/V8__cash_shifts_and_movements.sql`.
- `backend/src/test/java/com/hubon/backend/CashShiftIntegrationTests.java`.
- `backend/src/test/java/com/hubon/backend/PaymentPreparationRollbackIntegrationTests.java`.
- `frontend/src/app/core/services/cash-api.service.ts`.
- `frontend/src/app/shared/models/cash.model.ts`.
- `frontend/src/app/shared/components/payment-dialog/`.
- Specs de Caixa, Pedidos, Produtos e Comandas.
- `docs/business/cash-shifts.md` e este relatório.

## Arquivos alterados

- Backend: repositórios e serviço de pedidos; controller, entidade, repositório
  e serviço de pagamentos; segurança; seeder; DTOs e serviço do Balcão; testes
  de vendas, relatórios e autorização.
- Frontend: rotas, shell, permissões, serviços e modelos de pagamento; páginas
  de Dashboard, Produtos, Mesas, Comandas, Pedidos, Balcão, Caixa, Estoque,
  Relatórios, Usuários e Minha Conta; CSV; estilos globais; testes e auditoria
  visual. O componente exclusivo de Cozinha foi removido.
- Documentação: README, glossário, endpoints, arquitetura, banco, negócio,
  segurança, release, produto, testes, matriz operacional e status do MVP.

## Validação final

| Validação | Resultado |
| --- | --- |
| Backend `mvnw.cmd clean verify` | 93 testes, 0 falhas, 0 erros e 0 ignorados; JAR gerado. |
| Banco de testes | Perfil `test`, PostgreSQL `hubon_test`, Flyway V1 a V8 e `ddl-auto=validate`. |
| Frontend `npm test` | 73 testes aprovados em 21 arquivos. |
| Frontend `npm run build` | Build de produção concluído sem erros. |
| Microsoft Edge | 238 verificações aprovadas. |
| Resoluções | 1366x768, 1440x900, 1920x1080 e 1366x650. |
| Temas | Claro e escuro. |
| `git diff --check` | Aprovado sem erros de whitespace. |
| Dados locais de diagnóstico | Sessão encerrada, conta temporária e venda de teste removidas; saldo de estoque restaurado. |

A auditoria cobriu as rotas principais e os cenários de modal de produto,
variações nova e editada, várias linhas, menus no primeiro e último item, altura
reduzida, venda vazia, parcial e em preparo, venda mista, pagamento compartilhado,
Pedidos, turno e fechamento de Caixa, sidebar, redirecionamento de Cozinha,
overlays e ausência de rolagem horizontal. Screenshots e resultados foram
gerados apenas como artefatos locais ignorados pelo Git.

## Pendências reais

Não restaram pendências funcionais dentro deste escopo. Permanecem decisões
intencionais de compatibilidade: o perfil e os endpoints `KITCHEN` continuam no
backend, a URL `/cozinha` apenas redireciona e registros financeiros anteriores
à V8 podem não possuir `cash_shift_id`. Limitações gerais já registradas no MVP,
como refresh token, recuperação de senha e paginação navegável, não foram
ampliadas por esta entrega.
