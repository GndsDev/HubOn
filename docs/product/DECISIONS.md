# Decisions

Este documento explica como decisoes importantes do HubOn devem ser registradas.

Decisoes de produto, arquitetura, dominio, seguranca, banco de dados ou processo
devem ser documentadas antes de orientar implementacoes futuras. Quando a decisao
tiver impacto estrutural ou puder gerar duvidas no futuro, ela deve ser
registrada como ADR em `docs/adr/`.

## Quando criar um ADR

Crie ou atualize um ADR quando a decisao envolver:

- autenticacao ou autorizacao;
- estrategia de persistencia;
- mudanca de arquitetura;
- ciclo de vida de entidades importantes;
- modelo de estoque, financeiro ou dominio;
- padrao que afetara varias funcionalidades;
- escolha entre alternativas tecnicas relevantes.

## Relacao com este documento

Este arquivo funciona como guia e indice narrativo. Os registros oficiais ficam
nos ADRs.

ADRs existentes:

- [ADR-0001 Authentication using JWT](../adr/ADR-0001-authentication-using-jwt.md)
- [ADR-0002 Role hierarchy](../adr/ADR-0002-role-hierarchy.md)
- [ADR-0003 Soft Delete Strategy](../adr/ADR-0003-soft-delete-strategy.md)
- [ADR-0004 Inventory Ledger](../adr/ADR-0004-inventory-ledger.md)
- [ADR-0005 Inventory Consumption Lifecycle](../adr/ADR-0005-inventory-consumption-lifecycle.md)
- [ADR-0006 CurrentQuantity Cache](../adr/ADR-0006-current-quantity-cache.md)
- [ADR-0007 Documentation First](../adr/ADR-0007-documentation-first.md)
