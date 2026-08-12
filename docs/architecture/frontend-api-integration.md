# Integração entre frontend e API

O frontend Angular usa serviços tipados para acessar a API em `/api`. O contrato
real é definido pelos controllers e DTOs do backend; modelos TypeScript devem
acompanhar esses contratos, inclusive campos opcionais e enums.

## Serviços atuais

- `AuthService`: sessão, login, usuário atual e troca de senha.
- `SalesApiService`: vendas, itens, pagamentos, fechamento e cancelamento.
- `ProductApiService` e `CategoryApiService`: catálogo e escolhas.
- `StockApiService`: itens, movimentos e vínculos automáticos.
- `CashApiService`: turnos e movimentações de caixa.
- `MonthlyReportApiService`: consultas e exportações.
- `DashboardApiService` e `UserApiService`: resumo e gestão de acesso.

## Autenticação

Após o login, o frontend guarda a sessão local e o interceptor envia:

```http
Authorization: Bearer <token>
```

Rotas protegidas verificam autenticação e perfil para orientar a navegação, mas a
autorização efetiva permanece no Spring Security.

## Tratamento de estado

Ações pequenas atualizam somente o contexto necessário. Inclusão de item,
alteração de quantidade, remoção, pagamento e fechamento usam a `Sale` devolvida
pela API, sem recarregar a aplicação inteira. Erros de negócio são apresentados
em linguagem operacional.

## Convenções

- sem `any` para contornar incompatibilidades;
- datas ISO recebidas como strings e formatadas na apresentação;
- valores monetários enviados como números decimais compatíveis com o backend;
- parâmetros de relatório enviados pela query string;
- downloads PDF/XLSX tratados como `Blob`; CSV é montado no frontend a partir do
  relatório já carregado.
