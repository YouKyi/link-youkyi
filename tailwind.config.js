/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scanne le HTML GÉNÉRÉ (apps/) + les templates source. La génération
  // (build/generate.mjs) tourne avant Tailwind, donc apps/**/*.html existe au scan.
  content: ['./apps/**/*.html', './src/templates/**/*.html', './data/**/*.mjs'],
  darkMode: 'class',
  plugins: []
}
