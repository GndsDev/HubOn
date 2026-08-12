# Segurança

## Autenticação

O login recebe `username` e senha. O nome de usuário aceita de 3 a 40 letras,
números, ponto, hífen ou sublinhado; espaços externos são removidos e o valor é
convertido para minúsculas. Usuários inativos não autenticam.

O backend compara a senha com BCrypt e devolve um JWT com identificador, nome,
nome de usuário e perfis. A duração padrão é 480 minutos, configurável por
`HUBON_JWT_EXPIRATION_MINUTES` fora do Compose atual.

## Autorização

O Spring Security mantém a API stateless. Apenas `/api/auth/login` é público.
Ausência de autenticação retorna `401`; perfil insuficiente retorna `403`.

A interface atual é destinada a:

- `OWNER` (Dono): acesso à operação e criação de Gerentes;
- `ADMIN` (Gerente): acesso à operação e consulta de usuários.

Perfis adicionais permanecem no esquema por compatibilidade estrutural, mas não
fazem parte da navegação nem do fluxo de criação atual. O frontend protege todas
as rotas operacionais com Dono/Gerente; a API continua sendo a autoridade final.

## Segredos

- `.env` nunca deve ser versionado ou substituído durante atualização.
- `POSTGRES_PASSWORD`, `JWT_SECRET` e senhas iniciais precisam de valores fortes.
- `JWT_SECRET` deve ter ao menos 32 caracteres na instalação Windows.
- Tokens, senhas, dumps e logs não devem aparecer em documentação ou screenshots.
- `HUBON_SECURITY_PERMIT_ALL` deve permanecer `false` fora de testes controlados.

## CORS e exposição local

`HUBON_CORS_ALLOWED_ORIGINS` define origens autorizadas. A stack padrão publica
somente o frontend em `127.0.0.1:4200`; PostgreSQL e backend ficam expostos apenas
na rede Docker. O Compose de desenvolvimento publica `5432` e `8080` também em
`127.0.0.1`.

Para acesso em outra máquina, revise rede, firewall, TLS, segredo JWT e CORS antes
de alterar os vínculos. A configuração padrão não deve ser tratada como uma
implantação pública na internet.

## Seed

`HUBON_SEED_ENABLED=true` cria ou reutiliza o Dono configurado e, quando
habilitado, um Gerente. O seed também garante perfis e catálogo inicial de forma
idempotente. Em ambientes já inicializados, desative o seed quando ele não for
mais necessário.

As variáveis de usuário inicial são:

- `HUBON_SEED_OWNER_NAME`, `HUBON_SEED_OWNER_USERNAME`,
  `HUBON_SEED_OWNER_PASSWORD`;
- `HUBON_SEED_ADMIN_ENABLED`, `HUBON_SEED_ADMIN_NAME`,
  `HUBON_SEED_ADMIN_USERNAME`, `HUBON_SEED_ADMIN_PASSWORD`.

## Limitações atuais

O sistema ainda não oferece recuperação de senha, refresh token, bloqueio por
tentativas ou revogação centralizada de tokens. A troca de senha encerra a sessão
local do usuário, mas tokens já emitidos não são armazenados em uma denylist.
