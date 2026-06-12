# Notas de segurança

## Estado atual

O HubOn é um MVP para desenvolvimento local e rede privada confiável.

No perfil `local`:

- endpoints estão liberados com `permitAll`;
- CSRF está desabilitado;
- CORS aceita apenas origens configuradas;
- existe um operador local selecionado na interface;
- o seeder pode criar um usuário administrador para testes.

Essas escolhas facilitam o desenvolvimento, mas não representam uma
configuração de produção.

## O que ainda não existe

- Autenticação por login.
- JWT ou sessão autenticada.
- Autorização por perfil.
- Expiração ou revogação de credenciais.
- Recuperação segura de senha.
- Auditoria completa de ações.
- TLS configurado pela aplicação.
- Gestão centralizada de segredos.

## Operador local

`OperatorContextService` registra qual usuário deve ser associado à abertura de
comanda, criação de pedido e pagamento. A seleção é salva em `localStorage`.

Isso fornece autoria operacional básica, mas não prova a identidade de quem está
usando o navegador. Qualquer pessoa com acesso à interface pode trocar o
operador.

## Perfil de produção

O perfil `prod`:

- exige credenciais do banco por variáveis de ambiente;
- exige origens CORS explícitas;
- desativa o seeder;
- mantém `show-sql` desativado;
- bloqueia endpoints por padrão.

Não habilite `HUBON_SECURITY_PERMIT_ALL=true` em ambiente público.

## Rede local

- Libere portas apenas no perfil de rede privada do Windows.
- Restrinja `HUBON_CORS_ALLOWED_ORIGINS` à URL exata do frontend.
- Não use `*` como origem com credenciais.
- Não encaminhe as portas `4200`, `8080` ou `5432` no roteador.
- Não exponha diretamente o PostgreSQL para outras máquinas sem necessidade.
- Troque a senha padrão do usuário local e do banco.

## Recomendado para a próxima versão

1. Login com senha armazenada usando hash forte.
2. JWT de curta duração ou sessão segura.
3. Autorização por `ADMIN`, `WAITER`, `KITCHEN` e `CASHIER`.
4. TLS por proxy reverso.
5. Segredos fora do repositório.
6. Rate limiting e política de tentativas de login.
7. Logs de auditoria para cancelamentos, descontos e pagamentos.
8. Backup e restauração testados.
9. Cabeçalhos HTTP de segurança.
10. Revisão de CORS e CSRF conforme a estratégia de autenticação.

## Aviso

Não exponha a API ou o frontend do MVP à internet. Para uso fora de uma rede
local confiável, implemente autenticação real, autorização, TLS e gestão segura
de segredos antes da implantação.

