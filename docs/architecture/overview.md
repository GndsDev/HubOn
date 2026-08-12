# Arquitetura atual

## Visão geral

O HubOn é uma aplicação web local dividida em três camadas:

```text
Navegador
  -> Angular 21
  -> API HTTP/JSON
  -> Spring Boot 4 / Java 21
  -> Spring Data JPA
  -> PostgreSQL 16
```

Na instalação recomendada, Nginx entrega o frontend e encaminha `/api` para o
backend. Frontend, backend e banco executam em containers separados na mesma rede
do Docker Compose.

## Responsabilidades

### Frontend

- organiza os fluxos de Dashboard, Comandas, Balcão, Histórico, Caixa, catálogo,
  Estoque, Relatórios, Usuários e Minha Conta;
- mantém a experiência responsiva e atualiza localmente as ações operacionais;
- envia o JWT nas chamadas protegidas;
- apresenta validações e mensagens, sem substituir as regras do backend.

### Backend

- expõe os contratos HTTP em `/api`;
- autentica e autoriza usuários;
- executa regras de vendas, pagamentos, caixa e estoque em transações;
- calcula valores derivados e relatórios;
- preserva snapshots e autoria para auditoria.

### Banco

- guarda dados operacionais e financeiros no PostgreSQL;
- evolui exclusivamente por migrations Flyway;
- usa restrições para reforçar invariantes importantes, como um único caixa
  aberto e uma única venda aberta por número de mesa.

## Domínio simplificado

`Sale` é a raiz da operação. Uma venda pode ser:

- `TABLE`: uma comanda identificada por `tableNumber`;
- `COUNTER`: uma venda de balcão sem número de mesa.

Os valores de uma venda são derivados dos itens ativos e pagamentos. Produtos
possuem preço direto e podem ter grupos de escolhas. O estoque trabalha com
itens, vínculos automáticos e um ledger de movimentos. Pagamentos são registrados
no caixa que estiver aberto.

Não há cadastro autônomo de mesas, etapas de produção, variações de produto ou
imagens de catálogo no domínio atual.

## Consistência

- Controllers tratam HTTP e validação de entrada.
- Services concentram regras e transações.
- Repositories cuidam da persistência.
- DTOs definem o contrato público da API.
- O frontend não recalcula regras financeiras que já pertencem ao backend.
- Migrations publicadas são imutáveis; toda evolução usa um novo arquivo.

## Implantação

O `docker-compose.yml` define os containers `hubon-postgres`, `hubon-backend` e
`hubon-frontend`, todos com `restart: always` e verificações de saúde. O banco usa
o volume nomeado `hubon_postgres_data`; recriar containers não remove esse volume.
