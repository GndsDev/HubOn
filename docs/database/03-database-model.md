# Modelo de banco

## Evolucao V7

`V7__counter_tabs_and_monthly_reporting.sql` preserva as comandas anteriores como `TABLE` e adiciona em `tabs`:

- `type`: `TABLE` ou `COUNTER`;
- `customer_name`, `customer_phone` e `identification_note`: identificacao opcional do balcao;
- `closed_business_date`: competencia comercial calculada no fuso do estabelecimento.

`restaurant_table_id` passa a aceitar `NULL`, mas `chk_tabs_origin` exige mesa para `TABLE` e proibe mesa para `COUNTER`. O indice parcial de uma comanda aberta por mesa continua valido; valores `NULL` permitem varias vendas de balcao independentes. A migracao preenche `closed_business_date` dos registros antigos usando `closed_at` e cria indices agregados para relatorios sem modificar V1 a V6.

A documentação canônica do banco foi consolidada em:

- [database-model.md](database-model.md)

O projeto usa PostgreSQL, nomes em inglês, Flyway para migrations e
`spring.jpa.hibernate.ddl-auto=validate`.
