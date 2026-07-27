# Catálogo de produtos

## Modelo

O catálogo separa quatro conceitos:

```text
Produto base -> Variação vendável -> Escolhas do cliente -> Estoque opcional
```

O produto base guarda nome, descrição, categoria, fluxo, ordem, ativação e
disponibilidade. Ele não possui preço. A variação guarda nome, SKU, preço,
ordem, ativação e disponibilidade.

`active` remove o cadastro de novas operações sem apagar histórico.
`available` permite uma indisponibilidade temporária. O backend calcula
`complete` e só vende produto com categoria, produto e ao menos uma variação
ativos e disponíveis.

## Fluxos

- `REQUIRES_PREPARATION`: pratos, espetos, porções, caldos e bebidas preparadas;
- `DIRECT_SERVICE`: bebidas prontas e produtos embalados.

O perfil de usuário `KITCHEN` permanece. O valor antigo de fluxo de produto
`KITCHEN` foi migrado para `REQUIRES_PREPARATION` e não existe mais no domínio
de produto.

## Variações e preço

O preço pertence exclusivamente à variação. Uma variação única chamada
`Padrão` é ocultada na operação; variações reais aparecem junto ao produto. A
alteração de nome ou preço não afeta snapshots de pedidos existentes.

## Escolhas

Grupos definem mínimo, máximo, obrigatoriedade e opções ativas. O backend rejeita
grupo obrigatório vazio, limites inválidos, opção de outro produto e opção
inativa. O adicional integra o preço unitário e é congelado no item.

## Cadastro unificado

A tela usa três etapas:

1. Informações gerais e fluxo;
2. uma ou várias variações e preços, incluindo ação `Usar variação Padrão`;
3. vínculos opcionais de estoque e grupos de escolhas.

`POST /api/products/registration` salva produto, variações, vínculos e escolhas
em uma transação. `POST /api/products` continua disponível para criar um
cadastro incompleto que será complementado depois.

## Limites do MVP

O catálogo não inclui ficha técnica culinária, kits com composição de estoque,
imagens gerenciadas, delivery, fiscal ou preço por canal/horário.
