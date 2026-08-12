# Execução local

## Stack Docker

Com `.env` configurado:

```powershell
docker compose up -d --build
docker compose ps
```

Acesse `http://localhost:4200`. O frontend encaminha `/api` ao backend. Os
containers esperados são `hubon-postgres`, `hubon-backend` e `hubon-frontend`,
todos com política `restart: always` e healthcheck.

Para publicar banco e backend apenas no computador de desenvolvimento:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Isso libera `127.0.0.1:5432` e `127.0.0.1:8080` conforme o `.env`.

Comandos de diagnóstico:

```powershell
docker compose ps
docker compose logs --tail=100 backend
docker inspect -f "{{.Name}} -> {{.State.Health.Status}}" hubon-postgres hubon-backend hubon-frontend
```

## Execução direta para desenvolvimento

Banco PostgreSQL disponível e variáveis locais configuradas:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Em outro terminal:

```powershell
cd frontend
npm ci
npm start
```

O frontend de desenvolvimento usa `http://localhost:4200` e a API configurada em
`environment.development.ts`.

## Persistência

Parar ou recriar containers não apaga o banco. O volume nomeado deve ser
preservado. Uma limpeza de banco só é aceitável em ambiente descartável, com
backup, identificação exata do volume e autorização explícita.
