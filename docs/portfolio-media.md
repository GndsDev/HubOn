# Mídias do portfólio

Este documento descreve a geração reproduzível das capturas de tela e do vídeo
curto usados para apresentar o MVP do HubOn.

## Conteúdo gerado

As capturas usam resolução de `1440x900`, tema escuro e dados reais da API:

```text
docs/media/screenshots/
├── 01-dashboard.png
├── 02-mesas.png
├── 03-categorias.png
├── 04-produtos.png
├── 05-comandas.png
├── 06-pedidos.png
├── 07-cozinha.png
├── 08-caixa.png
├── 09-usuarios.png
└── 10-relatorios.png
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

Em dois terminais, inicie os serviços:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
cd frontend
npm start
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
- uma comanda aberta para essa mesa;
- pedidos nos estados recebido, preparando e pronto.

Regenerar as mídias não duplica os registros que já estiverem no estado
esperado. Para manter o material atual, uma comanda demo sem pagamentos e
aberta há mais de quatro horas tem seus pedidos exclusivos de portfólio
cancelados e é substituída por uma nova. A automação não fecha comandas, não
registra pagamentos e não apaga histórico.

## Configuração opcional

Os endereços e o navegador podem ser substituídos por variáveis de ambiente:

```powershell
$env:HUBON_BASE_URL = "http://localhost:4200"
$env:HUBON_API_URL = "http://localhost:8080/api"
$env:PLAYWRIGHT_CHROME_PATH = "C:\caminho\para\chrome.exe"
npm run portfolio:all
```

## Cuidados de publicação

- As capturas exibem somente dados locais de demonstração.
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

As capturas falham de propósito quando uma tela mostra `.error-panel`. Isso
impede que uma mídia com erro de integração seja publicada silenciosamente.
