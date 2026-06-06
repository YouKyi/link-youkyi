/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scanne le HTML GÉNÉRÉ (apps/) + les templates source. La génération
  // (build/generate.mjs) tourne avant Tailwind, donc apps/**/*.html existe au scan.
  content: ['./apps/**/*.html', './src/templates/**/*.html', './data/**/*.mjs'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          // Accent YouKyi (indigo). Identité noir/blanc ; le travail visuel des
          // cartes est porté par les couleurs par réseau (cf. src/input.css).
          primary: '#4f46e5', // indigo-600 (hover, carte mise en avant, footer)
          light: '#818cf8',   // indigo-400 (accents en mode sombre)
          bg: '#f8fafc',      // fond clair (variante pro)
          darkBg: '#0a0a0a',  // fond sombre quasi-noir (variante link)
          accent: '#e2e8f0'   // bordures/contours discrets
        }
      },
      fontFamily: {
        'mono-custom': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      }
    }
  },
  plugins: []
}
