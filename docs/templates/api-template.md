# API: [recurso]

## Objetivo

[Problema resolvido pelo endpoint.]

## Contrato

- Método: `GET | POST | PUT | PATCH | DELETE`
- Caminho: `/api/...`
- Acesso: `OWNER | ADMIN | outro perfil realmente autorizado`

### Request

```json
{
  "campo": "valor"
}
```

### Response

```json
{
  "id": 1
}
```

## Regras e erros

- [Validações e invariantes.]
- `400`: dados ou estado inválido.
- `401`: autenticação necessária.
- `403`: acesso negado.
- `404`: recurso ausente.
- `409`: integridade ou concorrência.

## Validação

- [Teste automatizado.]
- [Cenário de homologação.]
