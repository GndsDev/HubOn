# Configuração

## Arquivo `.env`

Crie o arquivo a partir de `.env.example` somente na primeira preparação:

```powershell
Copy-Item .env.example .env
```

Troque todos os valores `change-me`. Em atualização, preserve o `.env` existente
e nunca o substitua pelo exemplo.

## Compose

| Variável | Uso | Padrão/obrigação |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | nome estável do projeto e do volume | `hubon` |

## PostgreSQL

| Variável | Uso | Padrão/obrigação |
| --- | --- | --- |
| `POSTGRES_DB` | banco da aplicação | `hubon_db` |
| `POSTGRES_USER` | usuário do PostgreSQL | `hubon_user` |
| `POSTGRES_PASSWORD` | senha do PostgreSQL | obrigatória |

## JWT

| Variável | Uso | Padrão/obrigação |
| --- | --- | --- |
| `JWT_SECRET` | assinatura dos tokens | obrigatório e forte |

## CORS

| Variável | Uso | Padrão/obrigação |
| --- | --- | --- |
| `HUBON_CORS_ALLOWED_ORIGINS` | origens web permitidas | `http://localhost:4200` |

## Seed

| Variável | Uso | Padrão/obrigação |
| --- | --- | --- |
| `HUBON_SEED_ENABLED` | habilita a carga inicial | `false` no Compose quando omitida |
| `HUBON_SEED_OWNER_NAME` | nome do Dono inicial | obrigatório com seed ativo |
| `HUBON_SEED_OWNER_USERNAME` | nome de usuário do Dono | obrigatório com seed ativo |
| `HUBON_SEED_OWNER_PASSWORD` | senha inicial do Dono | obrigatória com seed ativo |
| `HUBON_SEED_ADMIN_ENABLED` | cria o Gerente inicial | `true` |
| `HUBON_SEED_ADMIN_NAME` | nome do Gerente inicial | obrigatório quando habilitado |
| `HUBON_SEED_ADMIN_USERNAME` | nome de usuário do Gerente | obrigatório quando habilitado |
| `HUBON_SEED_ADMIN_PASSWORD` | senha inicial do Gerente | obrigatória quando habilitado |

## Portas

| Variável | Uso | Padrão |
| --- | --- | --- |
| `FRONTEND_PORT` | porta local do sistema | `4200` |
| `POSTGRES_PORT` | PostgreSQL no Compose de desenvolvimento | `5432` |
| `BACKEND_PORT` | backend no Compose de desenvolvimento | `8080` |

O instalador Windows exige `POSTGRES_DB=hubon_db`, aceita somente
`COMPOSE_PROJECT_NAME=hubon`, rejeita segredos de exemplo e valida os nomes de
usuário iniciais.

## Perfis Spring

- `local`: usado ao executar o backend diretamente; propriedades particulares
  ficam em `application-local.properties`, que não deve conter segredos
  versionados.
- `prod`: usado no container; recebe banco, JWT e CORS por variáveis de ambiente.

Em ambos, Flyway está habilitado e o Hibernate usa `ddl-auto=validate`.

## Volume do banco

O Compose declara `hubon_postgres_data`. Com `COMPOSE_PROJECT_NAME=hubon`, o nome
efetivo costuma ser `hubon_hubon_postgres_data`. Confirme sempre pelo `docker
inspect hubon-postgres` antes de qualquer manutenção excepcional.

Recriar containers preserva o volume. Não use remoção de volumes, `down -v` ou
comandos globais de limpeza em uma atualização comum.
