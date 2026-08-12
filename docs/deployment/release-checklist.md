# Checklist de release

## Código e banco

- [ ] Branch e commit de entrega confirmados.
- [ ] Working tree limpo.
- [ ] Migrations existentes não foram alteradas.
- [ ] Mudanças de esquema usam uma nova migration.
- [ ] Nenhum segredo, dump, token ou credencial foi versionado.

## Validação

- [ ] `backend/.\mvnw.cmd clean verify` concluído.
- [ ] `frontend/npm test -- --watch=false` concluído.
- [ ] `frontend/npm run build` concluído.
- [ ] Compose validado com `.env.example` sem imprimir valores expandidos.
- [ ] Imagens Docker construídas.
- [ ] Fluxos principais homologados em tema claro e escuro.

## Operação

- [ ] Login por nome de usuário.
- [ ] Comanda aberta, movimentada, paga e fechada.
- [ ] Venda de balcão concluída.
- [ ] Remoção e cancelamento de item verificados separadamente.
- [ ] Caixa aberto, movimentado e conferido.
- [ ] Baixa e reversão de estoque verificadas.
- [ ] Relatórios e exportações verificados.

## Documentação

- [ ] README e índice atualizados.
- [ ] API, banco, regras e implantação coerentes com a entrega.
- [ ] Links locais válidos.
- [ ] Capturas representam a `main` e não contêm dados sensíveis.
- [ ] Termos e fluxos removidos não aparecem como funcionalidades atuais.
