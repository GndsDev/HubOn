# Notas de segurança

## Estado atual

O HubOn passou a usar autenticação JWT no backend. No perfil `local`, os
endpoints operacionais ficam protegidos por token e por perfis de acesso.

Ainda é um MVP para desenvolvimento local e rede privada confiável. A segurança
atual melhora a separação de responsabilidades, mas não substitui uma revisão
completa para produção pública.

## Login local de desenvolvimento

O seeder cria usuários iniciais quando `hubon.seed.enabled=true`. As credenciais
vêm de propriedades do backend, não do frontend:

| Propriedade | Variável de ambiente | Uso |
| --- | --- | --- |
| `hubon.seed.owner.name` | `HUBON_SEED_OWNER_NAME` | Nome do `OWNER` inicial |
| `hubon.seed.owner.email` | `HUBON_SEED_OWNER_EMAIL` | E-mail do `OWNER` inicial |
| `hubon.seed.owner.password` | `HUBON_SEED_OWNER_PASSWORD` | Senha do `OWNER` inicial |
| `hubon.seed.admin.enabled` | `HUBON_SEED_ADMIN_ENABLED` | Habilita ou desabilita o `ADMIN` inicial |
| `hubon.seed.admin.name` | `HUBON_SEED_ADMIN_NAME` | Nome do `ADMIN` inicial |
| `hubon.seed.admin.email` | `HUBON_SEED_ADMIN_EMAIL` | E-mail do `ADMIN` inicial |
| `hubon.seed.admin.password` | `HUBON_SEED_ADMIN_PASSWORD` | Senha do `ADMIN` inicial |

O modelo versionado fica em
`backend/src/main/resources/application-local.example.properties`. A configuração
real fica em `backend/src/main/resources/application-local.properties`, que é
ignorada pelo Git. As senhas são armazenadas com BCrypt. Para alterar em
ambiente local:

```powershell
$env:HUBON_SEED_OWNER_EMAIL="owner.local@hubon.test"
$env:HUBON_SEED_OWNER_PASSWORD="senha-local-forte"
$env:HUBON_SEED_ADMIN_EMAIL="admin.local@hubon.test"
$env:HUBON_SEED_ADMIN_PASSWORD="senha-admin-local-forte"
$env:HUBON_JWT_SECRET="segredo-local-longo-e-aleatorio"
```

Em produção, não use os valores padrão locais. A criação do primeiro dono deve
vir de variáveis de ambiente, setup seguro ou processo administrativo controlado.
Se o seeder for habilitado sem credenciais obrigatórias, a aplicação falha em
vez de criar usuário inseguro.

## Perfis e permissões

Perfis disponíveis:

- `OWNER`: dono ou responsável máximo.
- `ADMIN`: gerente ou administrador operacional.
- `WAITER`: garçom e atendimento.
- `KITCHEN`: cozinha.
- `CASHIER`: caixa.

Acesso por módulo:

| Módulo | Perfis |
| --- | --- |
| Dashboard | `OWNER`, `ADMIN` |
| Mesas | `OWNER`, `ADMIN`, `WAITER` |
| Comandas | `OWNER`, `ADMIN`, `WAITER`, `CASHIER` |
| Pedidos | `OWNER`, `ADMIN`, `WAITER` |
| Cozinha | `OWNER`, `ADMIN`, `KITCHEN` |
| Caixa | `OWNER`, `ADMIN`, `CASHIER` |
| Categorias | `OWNER`, `ADMIN` |
| Produtos | `OWNER`, `ADMIN` |
| Usuários | `OWNER`, `ADMIN` |
| Relatórios | `OWNER`, `ADMIN` |

Regras de criação de usuários:

- `OWNER` pode criar `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`.
- `OWNER` não cria outro `OWNER` pelo fluxo atual.
- `ADMIN` pode criar apenas `WAITER`, `KITCHEN` e `CASHIER`.
- `ADMIN` não cria `OWNER` nem outro `ADMIN`.
- `WAITER`, `KITCHEN` e `CASHIER` não criam usuários.

Essas regras são validadas no backend. A interface apenas reduz opções visíveis.

## JWT

O token carrega o usuário autenticado e seus perfis. O frontend salva a sessão
em `localStorage` e envia `Authorization: Bearer <token>` automaticamente nas
chamadas à API.

As operações autorais usam o usuário autenticado no backend:

- abrir comanda;
- criar pedido;
- registrar pagamento.

O antigo operador manual da topbar foi removido como fonte principal de autoria.

Configure o segredo do token fora do código:

```powershell
$env:HUBON_JWT_SECRET="segredo-longo-e-aleatorio"
$env:HUBON_JWT_EXPIRATION_MINUTES="480"
```

## Automação de portfólio

A geração de screenshots e vídeo também usa login JWT real. Configure as
credenciais apenas no terminal:

```powershell
$env:HUBON_PORTFOLIO_EMAIL="owner@hubon.local"
$env:HUBON_PORTFOLIO_PASSWORD="senha-local-nao-versionada"
```

Não versionar senha de portfólio, senha seedada ou segredo JWT. O usuário usado
para gerar mídia deve estar ativo e possuir perfil `OWNER` ou `ADMIN`.

## Respostas de segurança

- `401`: sem token, token inválido, token expirado ou credenciais inválidas.
- `403`: token válido, mas perfil sem permissão para o endpoint.

Os erros seguem o formato JSON padrão da API.

## Limitações do MVP

- Não há refresh token.
- Não há recuperação de senha.
- Não há política de força de senha.
- Não há bloqueio por tentativas inválidas.
- Não há auditoria completa de todas as ações sensíveis.
- TLS deve ser configurado externamente, por proxy reverso.
- O token fica no `localStorage`, adequado apenas para o contexto local do MVP.

## Rede local

- Libere portas apenas no perfil de rede privada do Windows.
- Restrinja `HUBON_CORS_ALLOWED_ORIGINS` à URL exata do frontend.
- Não use `*` como origem com credenciais.
- Não encaminhe as portas `4200`, `8080` ou `5432` no roteador.
- Não exponha diretamente o PostgreSQL para outras máquinas sem necessidade.
- Troque as senhas padrão antes de qualquer uso real.
- Troque `HUBON_JWT_SECRET` antes de qualquer uso fora do desenvolvimento.

## Recomendado para a próxima versão

1. Refresh token ou sessão segura de curta duração.
2. Fluxo seguro de troca e recuperação de senha.
3. Auditoria de criação de usuário, cancelamentos, descontos e pagamentos.
4. Tela administrativa para rotação segura de credenciais.
5. TLS por proxy reverso.
6. Segredos fora do repositório e gerenciados por ambiente.
7. Rate limiting e política de tentativas de login.
8. Testes de CORS, autenticação e autorização por endpoint.
9. Cabeçalhos HTTP de segurança.
10. Backup e restauração testados.

## Aviso

Não exponha a API ou o frontend do MVP à internet. Para uso fora de uma rede
local confiável, revise autenticação, autorização, TLS, armazenamento de token,
gestão de segredos e auditoria antes da implantação.
