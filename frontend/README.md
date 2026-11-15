# Front-end Radar dos Preços

Interface React/Vite em português para selecionar e salvar a cesta e comparar preços.

Veja o [README principal](../README.md) para instalação, configuração, publicação e limitações.

- `npm run dev`: servidor de desenvolvimento.
- `npm run lint`: ESLint.
- `npm run build`: build em `dist`.
- `npm run preview`: preview do build.
- `VITE_API_URL`: endereço da API usado apenas no desenvolvimento local (padrão `http://localhost:3000`).

No desenvolvimento, a interface usa o catálogo e a API locais. No build publicado, lê o snapshot estático gerado pelo GitHub Actions em `public/data/prices.json`.
