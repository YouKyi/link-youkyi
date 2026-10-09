# Fontes youkyi — self-hosted (woff2)

8 fichiers `.woff2`, sous-ensemble **latin**, récupérés depuis **Fontsource** (miroir jsdelivr), toutes sous licence **OFL**. Self-host = zéro dépendance à Google Fonts CDN (souveraineté).

## Mapping charte

| Famille | Graisses | Usage |
|---|---|---|
| **Space Grotesk** | 700 | wordmark `youkyi_` uniquement |
| **Poppins** | 500 · 600 · 700 | titres (H3 = 500 · H1/H2 = 600 · déclarations = 700) |
| **Inter** | 400 · 500 | corps, UI, légendes |
| **IBM Plex Mono** | 400 · 500 | code, commandes, labels techniques |

## Usage

Importer `fonts.css` (les `@font-face` pointent les `.woff2` en relatif), puis utiliser `font-family: 'Space Grotesk' | 'Poppins' | 'Inter' | 'IBM Plex Mono'`.

> Tokens de référence : `design-system-youkyi/brand/youkyi.tokens.json`. Charte : `brand.md` §05 Typographie.
