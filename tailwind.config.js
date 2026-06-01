/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './404.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0f6cf4', // bleu OcciClean, contraste AA (~4.7:1) sur fond clair
          light: '#04dafe',   // cyan OcciClean, accents
          bg: '#f8fafc',
          darkBg: '#0b1220',
          accent: '#e2e8f0'
        }
      },
      fontFamily: {
        'mono-custom': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      }
    }
  },
  plugins: []
}
