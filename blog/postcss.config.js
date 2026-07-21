// Config próprio do projeto do blog. Sem isso, o Next pode subir a árvore de
// pastas e encontrar o postcss.config do projeto principal (ex: com Tailwind
// em formato ESM), o que quebra o build do CSS aqui.
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};
