# Instalação no Windows

## Pré-requisitos

- Windows 10 ou 11;
- Docker Desktop instalado;
- Docker Compose disponível;
- PowerShell aberto como administrador;
- `.env` preenchido com segredos reais.

No Docker Desktop, mantenha habilitada a inicialização com o Windows. O HubOn
também registra uma tarefa agendada que solicita a abertura silenciosa do Docker
quando necessário.

## Preparar a configuração

Na primeira instalação:

```powershell
Copy-Item .env.example .env
notepad .env
```

Use `POSTGRES_DB=hubon_db` e `COMPOSE_PROJECT_NAME=hubon`. Troque senhas de
exemplo e use um `JWT_SECRET` com pelo menos 32 caracteres.

## Instalar

No repositório atualizado:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\install-hubon-windows.ps1
```

O caminho padrão é `C:\HubOn`. Para escolher outro:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\install-hubon-windows.ps1 -InstallPath "D:\HubOn"
```

O instalador:

- valida privilégios, Docker Desktop, Compose e configuração;
- copia os arquivos sem artefatos de desenvolvimento nem `.git`;
- não sobrescreve um `.env` já existente no destino;
- constrói as imagens e inicia a stack;
- aguarda os três containers ficarem saudáveis;
- registra a tarefa agendada `HubOn`;
- cria `HubOn.lnk` na área de trabalho, salvo com
  `-SkipDesktopShortcut`.

## Inicialização automática

`scripts/start-hubon.ps1` localiza o Docker, inicia o engine se necessário,
executa `docker compose up -d` e aguarda a saúde dos containers. O diagnóstico é
gravado em `C:\HubOn\logs\startup.log`, com rotação simples.

## Validação

```powershell
docker compose --project-directory C:\HubOn --env-file C:\HubOn\.env -f C:\HubOn\docker-compose.yml ps
```

Abra `http://localhost:4200` e entre com o nome de usuário configurado no seed.
Não exponha senhas em logs ou documentação.
