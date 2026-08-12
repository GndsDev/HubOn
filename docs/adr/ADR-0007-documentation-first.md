# ADR-0007: Documentação alinhada à implementação

Data: 2026-06-25
Status: Aceito

## Contexto

Documentos desatualizados criam um segundo domínio fictício e aumentam o risco de
decisões incorretas.

## Decisão

Atualizar documentação, testes e contratos públicos junto com mudanças
relevantes. Migrations, código executável e testes são a fonte de verdade para
auditar o estado atual; ADRs registram decisões duradouras, não funcionalidades
planejadas como se estivessem entregues.

## Consequências

- Toda mudança de domínio revisa regras, API, banco e homologação afetados.
- Documentos históricos conflitantes são removidos ou marcados claramente.
- Decisões arquiteturais relevantes continuam registradas em ADR.
