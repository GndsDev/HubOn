# Mídias do portfólio

Este documento descreve a geração reproduzível das capturas de tela e do vídeo
curto usados para apresentar o MVP do HubOn.

## Conteúdo gerado

As capturas usam resolução de `1440x900`, tema escuro e dados reais da API:

```text
docs/media/screenshots/
├── 01-dashboard.png
├── 02-comandas.png
├── 03-balcao.png
├── 04-historico.png
├── 05-categorias.png
├── 06-produtos.png
├── 07-estoque.png
├── 08-caixa.png
├── 09-relatorios.png
└── 10-usuarios.png
```

O vídeo de navegação fica em:

```text
docs/media/videos/hubon-demo.webm
```

## Pré-requisitos

- PostgreSQL local em execução.
- Backend disponível em `http://localhost:8080`.
- Frontend disponível em `http://localhost:4200`.
- Google Chrome ou Microsoft Edge instalado.
- Dependências do frontend instaladas com `npm install`.
- Usuário `OWNER` ou `ADMIN` disponível para autenticar a automação.

Em dois terminais, inicie os serviços:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
cd frontend
npm start
```

Configure as credenciais somente no terminal. Não salve a senha em arquivos
versionados:

```powershell
$env:HUBON_PORTFOLIO_USERNAME="owner"
$env:HUBON_PORTFOLIO_PASSWORD="senha-local-nao-versionada"
```

## Comandos

Dentro de `frontend/`:

```powershell
npm run portfolio:screenshots
npm run portfolio:video
npm run portfolio:all
```

- `portfolio:screenshots` recria as dez imagens.
- `portfolio:video` recria somente o vídeo.
- `portfolio:all` executa as duas etapas.

O suporte local do Playwright para gravação em WebM é instalado
automaticamente na primeira execução. Esse arquivo temporário fica em
`frontend/.playwright/` e não é versionado.

## Dados de demonstração

Antes da captura, o script verifica a API e prepara dados idempotentes:

- categoria `Portfólio HubOn`;
- produto `Menu Portfólio`;
- mesa `9901`, identificada como `Mesa Demo Portfólio`;
- uma venda de mesa aberta;
- um item ativo nessa venda.

O script autentica em `POST /api/auth/login`, guarda a sessão no
`localStorage` com a mesma chave usada pelo frontend (`hubon-auth-session`) e
envia `Authorization: Bearer <token>` em todas as chamadas diretas à API. A
automação não usa `permit-all` e não depende do antigo operador manual.

Regenerar as mídias reutiliza a categoria, o produto, a mesa, a venda aberta e
o item de demonstração quando eles já existem. A automação não fecha vendas,
não registra pagamentos, não cancela itens e não apaga histórico.

## Configuração opcional

Os endereços e o navegador podem ser substituídos por variáveis de ambiente:

```powershell
$env:HUBON_BASE_URL = "http://localhost:4200"
$env:HUBON_API_URL = "http://localhost:8080/api"
$env:PLAYWRIGHT_CHROME_PATH = "C:\caminho\para\chrome.exe"
$env:HUBON_PORTFOLIO_USERNAME = "owner"
$env:HUBON_PORTFOLIO_PASSWORD = "senha-local-nao-versionada"
npm run portfolio:all
```

## Cuidados de publicação

- As capturas exibem somente dados locais de demonstração.
- Nunca versionar `HUBON_PORTFOLIO_PASSWORD`, senha seedada ou JWT secret.
- O vídeo oficial é curto e deve permanecer pequeno o suficiente para o
  repositório. A versão atual usa WebM para reduzir o tamanho.
- Antes de publicar uma nova versão, revise visualmente todas as imagens e o
  vídeo para evitar mensagens de erro, carregamento incompleto ou dados reais
  de terceiros.
- Caso o vídeo cresça de forma significativa, publique-o em uma plataforma de
  mídia e mantenha no repositório apenas o link.

## Solução de problemas

Se a automação informar que um serviço está indisponível, confirme backend e
frontend nos endereços configurados. Se o navegador não for encontrado,
defina `PLAYWRIGHT_CHROME_PATH`.

Se aparecer a mensagem “Configure HUBON_PORTFOLIO_USERNAME e
HUBON_PORTFOLIO_PASSWORD para gerar as mídias.”, defina as duas variáveis no
terminal atual e execute o comando novamente.

Se a autenticação for recusada, confirme se o usuário está ativo, possui perfil
`OWNER` ou `ADMIN` e se a senha local foi configurada antes da criação desse
usuário no banco.

As capturas falham de propósito quando uma tela mostra `.error-panel`. Isso
impede que uma mídia com erro de integração seja publicada silenciosamente.
