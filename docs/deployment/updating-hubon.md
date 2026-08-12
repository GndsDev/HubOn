# Atualização segura do HubOn

## Antes de atualizar

No repositório usado como fonte da instalação:

```powershell
git status
git branch --show-current
git fetch origin
```

Pare se houver alterações não commitadas, commits locais não enviados ou
divergência que possa causar perda. Não descarte trabalho com reset, limpeza,
rebase ou force push.

Com a `main` limpa:

```powershell
git switch main
git pull --ff-only origin main
```

Confirme que o `.env` da instalação existe. Nunca o substitua pelo
`.env.example`.

## Instalação gerenciada no Windows

Execute novamente, como administrador, o instalador a partir do repositório
atualizado:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\install-hubon-windows.ps1
```

O destino mantém o `.env` existente. O instalador atualiza os arquivos, reconstrói
as imagens e reinicia a stack usando o mesmo projeto e volume persistente.

## Stack executada no próprio repositório

Depois do fast-forward:

```powershell
docker compose build --pull
docker compose up -d --force-recreate
docker compose ps
```

Esses comandos podem recriar containers, mas preservam o volume do PostgreSQL.

## Validação

```powershell
docker inspect -f "{{.Name}} -> restart={{.HostConfig.RestartPolicy.Name}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{end}}" hubon-postgres hubon-backend hubon-frontend
docker logs hubon-backend --tail 100
```

Confirme PostgreSQL, Flyway, validação do Hibernate e inicialização do Spring
Boot. Depois abra `http://localhost:4200`.

## Proibições em atualização comum

- não use `docker compose down -v`;
- não remova volumes nem execute comandos de limpeza global;
- não use limpeza global do Docker;
- não apague o banco para corrigir erro de migration;
- não altere migrations já aplicadas;
- não use `flyway repair` como atalho;
- não imprima segredos do `.env`.

Se a inicialização falhar por histórico incompatível, interrompa a atualização,
faça backup e trate a migração como manutenção excepcional documentada.
