# Identidade visual do HubOn

## Assets oficiais

Os assets da marca ficam em `frontend/public/assets/brand/`.

- `logo-hubon.png`: logo oficial usada exclusivamente na sidebar.
- `favicon.png`: favicon oficial exibido na aba do navegador.

O favicon é uma versão quadrada e simplificada da identidade HubOn. Ele usa
apenas o símbolo H e seu contorno, sem texto, e foi recortado para manter o
conteúdo centralizado e legível em tamanhos pequenos.

## Referências

O favicon é declarado uma única vez em `frontend/src/index.html`:

```html
<link rel="icon" type="image/png" sizes="256x256" href="assets/brand/favicon.png">
```

A sidebar referencia `logo-hubon.png` por meio da classe
`.sidebar-brand-logo`. O favicon não deve substituir essa imagem.

## Convenções

- Novos assets de marca devem ficar em `frontend/public/assets/brand/`.
- Não reutilizar o favicon como logo de interface.
- Não criar versões duplicadas sem um uso explícito no frontend.
- Ao substituir o favicon, manter o nome `favicon.png` ou atualizar sua única
  referência no `index.html`.
- Antes de remover um asset, confirmar que ele não aparece nas buscas do
  frontend, configurações ou documentação.
