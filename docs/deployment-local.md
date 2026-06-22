# Execução local e em rede

## Pré-requisitos

- PostgreSQL instalado e em execução.
- Java 21.
- Node.js e npm.
- Portas `4200` e `8080` livres.

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
