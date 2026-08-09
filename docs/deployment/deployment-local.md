# Execução local e em rede

## Pré-requisitos

Para a stack completa em containers:

- Docker Desktop com Docker Compose.
- Portas `5432`, `8080` e `4200` livres.

Para executar os componentes diretamente, sem Docker:

- PostgreSQL instalado e em execução.
- Java 21.
- Node.js e npm.
- Portas `4200` e `8080` livres.

## Stack completa com Docker

O Compose da raiz executa PostgreSQL, backend e frontend na rede interna
`hubon-network`. O backend acessa o banco por
`jdbc:postgresql://postgres:5432/hubon_db`, e o frontend encaminha `/api` ao
backend pelo Nginx. O desenvolvimento direto com Angular continua usando a URL
definida em `environment.development.ts`.

Crie o arquivo local de ambiente a partir do modelo e substitua os placeholders
por valores próprios:

```powershell
Copy-Item .env.example .env
```

O arquivo `.env` contém credenciais locais e não é versionado. O
`.env.example` documenta todas as variáveis necessárias sem armazenar segredos
reais.

Inicie e confira a stack:

```powershell
docker compose up -d --build
docker compose ps
```

Serviços publicados:

| Container | Porta | Uso |
| --- | --- | --- |
| `hubon-postgres` | `5432` | Banco operacional persistente do HubOn |
| `hubon-backend` | `8080` | API Spring Boot |
| `hubon-frontend` | `4200` | Aplicação Angular servida pelo Nginx |

Na máquina do cliente, o Compose cria somente `hubon_db` por padrão. O banco
`hubon_test` não integra a stack de execução e não é criado pela aplicação; ele
existe apenas em ambientes de desenvolvimento ou na CI temporária do GitHub.

O PostgreSQL usa o volume nomeado `hubon_hubon_postgres_data`. O mesmo volume é
reutilizado quando os containers são recriados, portanto uma atualização da
stack não apaga o banco. Nunca use `docker compose down -v` para uma atualização
normal.

Os três serviços usam `restart: unless-stopped`. Após a primeira execução de
`docker compose up -d`, o daemon Docker volta a iniciá-los automaticamente. No
Windows, confirme uma única vez no Docker Desktop:

```text
Settings > General > Start Docker Desktop when you sign in to your computer
```

Essa opção deve ser habilitada pela interface do Docker Desktop; não altere os
arquivos internos do aplicativo para forçá-la.

Comandos seguros de operação:

```powershell
docker compose ps
docker compose logs --tail=100 backend
docker compose stop
docker compose start
```

Evite publicar a porta `5432` fora da máquina e não exponha esta stack
diretamente à internet.

## PostgreSQL

O perfil local deve ser configurado por variáveis de ambiente ou pelo arquivo
local ignorado `backend/src/main/resources/application-local.properties`.

```text
Host: localhost
Porta: 5432
Banco: hubon_db
Usuário: hubon_user
Senha: definida por DB_PASSWORD
```

Exemplo de criação pelo `psql` com um usuário administrador:

```sql
CREATE USER hubon_user WITH PASSWORD 'change-me';
CREATE DATABASE hubon_db OWNER hubon_user;
```

O Flyway cria as tabelas automaticamente ao iniciar o backend. O Hibernate
apenas valida o esquema com `ddl-auto=validate`.

### Recriacao da baseline local (somente desenvolvimento)

Enquanto o HubOn nao possui dados reais em desenvolvimento, a baseline
`V1__initial_schema.sql` pode ser ajustada para acompanhar a simplificacao do
dominio. Quando isso acontecer, os bancos locais que ja aplicaram a V1 antiga
devem ser recriados do zero.

Este procedimento nunca deve ser executado na máquina do cliente.

Recrie tanto `hubon_test` quanto `hubon_db` quando a V1 mudar em uma fase sem
dados reais. Nao use `flyway repair` para corrigir checksum nesse caso: isso
apenas faria o Flyway aceitar um schema antigo como se fosse o schema novo.

No container local `hubon-postgres`, recrie somente o banco necessario:

```sql
DROP DATABASE IF EXISTS hubon_db WITH (FORCE);
CREATE DATABASE hubon_db OWNER hubon_user;
```

Para o banco de testes:

```sql
DROP DATABASE IF EXISTS hubon_test WITH (FORCE);
CREATE DATABASE hubon_test OWNER hubon_user;
```

Depois inicie o backend normalmente e deixe o Flyway aplicar as migrations.
Nunca altere uma migration ja aplicada em ambiente com dados reais; nesses
ambientes, crie uma nova migration incremental.

Para usar outros valores:

```powershell
$env:DB_URL="jdbc:postgresql://localhost:5432/hubon_db"
$env:DB_USERNAME="hubon_user"
$env:DB_PASSWORD="change-me"
```

## Credenciais locais do seeder

O login inicial de desenvolvimento é criado pelo backend quando
`hubon.seed.enabled=true`. O frontend não contém e não preenche senha padrão.

Crie a configuração local a partir do modelo seguro:

```powershell
Copy-Item backend\src\main\resources\application-local.example.properties `
  backend\src\main\resources\application-local.properties
```

Depois configure suas próprias credenciais antes de iniciar o backend:

```powershell
$env:HUBON_SEED_OWNER_NAME="Proprietario"
$env:HUBON_SEED_OWNER_EMAIL="owner.local@hubon.test"
$env:HUBON_SEED_OWNER_PASSWORD="senha-local-forte"
$env:HUBON_SEED_ADMIN_ENABLED="true"
$env:HUBON_SEED_ADMIN_NAME="Administrador"
$env:HUBON_SEED_ADMIN_EMAIL="admin.local@hubon.test"
$env:HUBON_SEED_ADMIN_PASSWORD="senha-admin-local-forte"
$env:HUBON_JWT_SECRET="segredo-local-longo-e-aleatorio"
```

As senhas são salvas com BCrypt. Configure esses valores antes da primeira
criação dos usuários seedados. Não use placeholders ou valores locais em
produção.

## Execução em localhost

### Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

API:

```text
http://localhost:8080/api
```

### Frontend

Em outro terminal:

```powershell
cd frontend
npm install
npm start
```

Interface:

```text
http://localhost:4200
```

O perfil padrão do backend é `local`. Ele:

- usa as credenciais locais ou variáveis de ambiente;
- executa o seeder;
- protege os endpoints por JWT e roles;
- aceita CORS de `localhost:4200` e `127.0.0.1:4200`;
- mantém `show-sql` ativo;
- escuta em `0.0.0.0` para permitir teste em rede privada.

## Localhost e IP do servidor

`localhost` sempre representa a própria máquina. Se outro computador abrir
`http://localhost:4200`, ele tentará acessar um frontend instalado nele mesmo.

Em rede local, use o IP da máquina onde HubOn está rodando, por exemplo:

```text
http://192.168.0.10:4200
```

### Descobrir o IP no Windows

No terminal:

```powershell
ipconfig
```

Procure o campo `Endereço IPv4` do adaptador conectado. Ignore adaptadores
virtuais e endereços desconectados.

## Execução em rede local

Supondo que o servidor tenha o IP `192.168.0.10`, configure a origem permitida
antes de iniciar o backend:

```powershell
$env:HUBON_CORS_ALLOWED_ORIGINS="http://192.168.0.10:4200"
cd backend
.\mvnw.cmd spring-boot:run
```

Inicie o frontend aceitando conexões externas:

```powershell
cd frontend
npm run start:network
```

Abra em outro computador:

```text
http://192.168.0.10:4200
```

O ambiente de desenvolvimento monta a API usando o mesmo hostname aberto no
navegador. Nesse exemplo, o frontend acessa:

```text
http://192.168.0.10:8080/api
```

### Alterar `environment.apiUrl`

Desenvolvimento e rede local usam:

```text
frontend/src/environments/environment.development.ts
```

O comportamento padrão acompanha o hostname do navegador. Se frontend e backend
estiverem em máquinas diferentes, informe explicitamente o servidor:

```ts
export const environment = {
  apiUrl: 'http://192.168.0.10:8080/api',
};
```

O arquivo `environment.ts` usa `/api` no build de produção, esperando frontend
e backend atrás do mesmo proxy reverso.

## CORS

O backend não libera qualquer origem. Informe URLs exatas, separadas por vírgula:

```powershell
$env:HUBON_CORS_ALLOWED_ORIGINS="http://192.168.0.10:4200,http://192.168.0.11:4200"
```

Reinicie o backend depois de mudar a variável.

Não use `*` como origem. Em produção, `HUBON_CORS_ALLOWED_ORIGINS` é obrigatório.

## Firewall do Windows

Se outro computador não conectar, confirme primeiro que ambos estão na mesma
rede privada. Depois, permita as portas apenas no perfil privado.

Em PowerShell executado como administrador:

```powershell
New-NetFirewallRule -DisplayName "HubOn Frontend" -Direction Inbound -Protocol TCP -LocalPort 4200 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "HubOn Backend" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
```

Não libere a porta `5432` do PostgreSQL se somente o backend local acessa o
banco.

Para remover as regras:

```powershell
Remove-NetFirewallRule -DisplayName "HubOn Frontend"
Remove-NetFirewallRule -DisplayName "HubOn Backend"
```

## Perfil de produção

O perfil `prod` exige configurações explícitas:

```powershell
$env:SPRING_PROFILES_ACTIVE="prod"
$env:DB_URL="jdbc:postgresql://servidor:5432/hubon_db"
$env:DB_USERNAME="usuario"
$env:DB_PASSWORD="senha"
$env:HUBON_CORS_ALLOWED_ORIGINS="https://hubon.exemplo.com"
$env:HUBON_JWT_SECRET="segredo-longo-e-aleatorio"
cd backend
.\mvnw.cmd spring-boot:run
```

No perfil `prod`:

- o seeder fica desativado;
- `show-sql` fica desativado;
- Open Session in View permanece desativado;
- CORS aceita somente origens informadas;
- endpoints ficam bloqueados por padrão.
- caso o seeder seja habilitado manualmente, `hubon.seed.owner.*` deve vir de
  configuração explícita do ambiente.

Build do frontend:

```powershell
cd frontend
npm run build
```

## Limitações de segurança

O MVP possui login JWT e autorização por perfil, mas ainda não tem refresh token,
recuperação de senha, política de tentativas ou auditoria completa.

- Use apenas em localhost ou rede privada confiável.
- Configure credenciais seedadas próprias e troque `HUBON_JWT_SECRET`.
- Não encaminhe portas no roteador.
- Não exponha a API ou o banco à internet.
- Não habilite `HUBON_SECURITY_PERMIT_ALL=true` em ambiente público.

Antes de uma implantação pública, são obrigatórios TLS, gestão segura de
segredos, política de credenciais, auditoria e revisão de infraestrutura.

Consulte [security-notes.md](security-notes.md).
