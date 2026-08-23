# Teia de Ideias V2

Um ambiente visual onde ideias, decisões, ações e resultados se conectam.

## O que há nesta versão

- várias teias independentes, com criação, renomeação, duplicação e exclusão;
- canvas fluido com pan, zoom, minimapa, enquadramento, snap e multisseleção;
- seis tipos de nó: ideia, ação, decisão, experimento, resultado e nota;
- status, descrição, tags, cor e link por nó;
- conexões visuais, busca e atalhos de teclado;
- persistência automática no navegador;
- importação e backup em JSON e exportação de cada canvas em PNG;
- layout responsivo para desktop e telas menores.

## Privacidade e persistência

Não existe conta, backend ou banco remoto. Os dados ficam no `localStorage` do navegador atual. Use **Backup** periodicamente para guardar uma cópia JSON.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```

Stack: React, TypeScript, Vite e React Flow (`@xyflow/react`).

## Publicação

O workflow em `.github/workflows/deploy.yml` compila a branch `main` e publica o conteúdo estático no GitHub Pages.

Este é um projeto novo e separado. O repositório histórico `leothaylor/9ideia` não é alterado nem reutilizado.
