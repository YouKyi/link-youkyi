const { dirname, relative, resolve, sep } = require('node:path');

module.exports = {
  plugins: [
    require('postcss-import')(),
    require('tailwindcss')(),
    {
      postcssPlugin: 'local-font-urls',
      Declaration(decl) {
        if (decl.prop !== 'src' || decl.parent.name !== 'font-face') return;
        // Les fontes restent dans le kit intact ; leurs URL survivent au regroupement CSS.
        decl.value = decl.value.replace(/url\((['"]?)(\.{1,2}\/[^'")]+)\1\)/g, (_, quote, url) => {
          const file = resolve(dirname(decl.source.input.file), url);
          return `url('/${relative(__dirname, file).split(sep).join('/')}')`;
        });
      }
    }
  ]
};
