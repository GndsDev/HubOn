# API: [Nome do endpoint ou recurso]

## Endpoint

`/api/...`

## Método

`GET | POST | PUT | PATCH | DELETE`

## Permissões

Perfis autorizados:

- `OWNER`
- `ADMIN`
- `WAITER`
- `KITCHEN`
- `CASHIER`

## Request

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Body

```json
{
  "campo": "valor"
}
```

## Response

### Sucesso

Status esperado: `200 OK`

```json
{
  "id": 1
}
```

## Erros

- `400 Bad Request`: requisição inválida.
- `401 Unauthorized`: usuário não autenticado.
- `403 Forbidden`: usuário sem permissão.
- `404 Not Found`: recurso não encontrado.
- `409 Conflict`: conflito com regra de negócio ou estado atual.

## Regras

Liste regras de negócio e validações aplicadas pelo endpoint.

- 

## Exemplos

### Requisição

```http
POST /api/exemplo
```

### Resposta

```json
{
  "mensagem": "exemplo"
}
```

