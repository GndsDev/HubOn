# ADR-0003 Soft Delete Strategy

Data: 2026-06-25
Status: Aceito

## Contexto

O HubOn registra operacoes que precisam manter historico, como produtos vendidos,
mesas, comandas, pedidos e pagamentos.

## Problema

Excluir fisicamente registros operacionais pode quebrar historico, relatorios,
auditoria e entendimento de vendas antigas.

## Alternativas consideradas

- Exclusao fisica imediata.
- Soft delete com campos de atividade/status.
- Proibir qualquer remocao.

## Decisao

Usar soft delete ou desativacao sempre que a entidade possuir valor historico ou
impacto operacional. Produtos, categorias e mesas devem preservar historico.
Registros financeiros e operacionais relevantes nao devem ser apagados sem
estrategia documental especifica.

## Consequencias

- Historico e snapshots permanecem consistentes.
- Consultas precisam considerar status/atividade.
- A interface deve deixar claro quando um registro esta inativo.
- Qualquer exclusao fisica futura exige justificativa e ADR ou decisao
  documentada.

## Status

Aceito.

## Data

2026-06-25.
