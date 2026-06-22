# Configuração Segura

Este documento define quais arquivos de configuração entram no Git e quais
devem permanecer apenas na máquina de desenvolvimento ou no ambiente de
execução.

## Arquivos versionados

Devem permanecer no repositório:

- `backend/src/main/resources/application.properties`
- `backend/src/main/resources/application-prod.properties`
- `backend/src/main/resources/application-local.example.properties`
- `backend/src/main/resources/db/migration/`
- `frontend/src/`
- `frontend/public/`
- `docs/`
- `README.md`
- `backend/pom.xml`
- `backend/mvnw`
- `backend/mvnw.cmd`
- `frontend/package.json`
- `frontend/package-lock.json`

## Arquivos não versionados

Não devem entrar no Git:

- `backend/src/main/resources/application-local.properties`
- `.env`
- `.env.*`, exceto `.env.example`
- `backend/target/`
- `frontend/node_modules/`
- `frontend/dist/`
- `frontend/.angular/`
- `frontend/.playwright/`
- relatórios, caches, logs, dumps e bancos locais

Esses arquivos podem conter senhas, secrets, tokens, dados locais ou artefatos
gerados automaticamente.

## Criar configuração local

Copie o exemplo seguro:

```powershell
Copy-Item backend\src\main\resources\application-local.example.properties `
  backend\src\main\resources\application-local.properties
```

Depois edite `application-local.properties` com valores do seu ambiente. Esse
arquivo é ignorado pelo Git.

## Banco de dados

Configure via variáveis de ambiente ou no arquivo local ignorado:

```powershell
$env:DB_URL="jdbc:postgresql://localhost:5432/hubon_db"
$env:DB_USERNAME="hubon_user"
$env:DB_PASSWORD="change-me"
```

No arquivo local:

```properties
spring.datasource.url=${DB_URL:jdbc:postgresql://localhost:5432/hubon_db}
spring.datasource.username=${DB_USERNAME:hubon_user}
spring.datasource.password=${DB_PASSWORD:change-me}
```

## JWT

O segredo do JWT deve vir do ambiente em qualquer uso real:

```powershell
$env:HUBON_JWT_SECRET="use-um-segredo-longo-e-aleatorio"
```

O perfil `prod` exige `HUBON_JWT_SECRET`. Não use placeholders como segredo de
produção.

## Seeder local

O usuário `OWNER` inicial é configurado por:

```powershell
$env:HUBON_SEED_OWNER_NAME="Proprietario"
$env:HUBON_SEED_OWNER_EMAIL="owner@hubon.local"
$env:HUBON_SEED_OWNER_PASSWORD="change-me"
```

O `ADMIN` inicial, se habilitado, é configurado por:

```powershell
$env:HUBON_SEED_ADMIN_ENABLED="true"
$env:HUBON_SEED_ADMIN_NAME="Administrador"
$env:HUBON_SEED_ADMIN_EMAIL="admin@hubon.local"
$env:HUBON_SEED_ADMIN_PASSWORD="change-me"
```

As senhas seedadas são gravadas com BCrypt. Configure os valores antes da
primeira criação dos usuários no banco.

## Diferença entre os arquivos

`application.properties`
: Configuração base versionada. Deve conter padrões estruturais e placeholders
seguros.

`application-prod.properties`
: Configuração versionada do perfil de produção. Deve exigir secrets por
variáveis de ambiente.

`application-local.example.properties`
: Modelo versionado para desenvolvimento local. Deve conter apenas placeholders
ou valores seguros de exemplo.

`application-local.properties`
: Configuração real da máquina local. Pode conter senhas locais, URL de banco e
segredo JWT local. Fica fora do Git.

## Boas práticas

- Não coloque secrets em HTML, TypeScript, JavaScript ou documentação pública.
- Não commite `target/`, `dist/`, `node_modules/`, caches ou relatórios.
- Não altere migrations para esconder dados locais; migrations são parte do
  histórico do banco.
- Troque qualquer senha ou segredo que tenha sido exposto antes de publicar o
  repositório.
