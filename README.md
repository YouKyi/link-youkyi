# link-youkyi

Pages de liens (« link in bio ») de **YouKyi**, en HTML statique + Tailwind CSS, avec un **fond 3D animé de datacenter** (Three.js auto-hébergé). Le contenu est décrit en JSON et un petit script Node génère les pages. Déployé sur Vercel.

Deux variantes, une source unique, **thème sombre uniquement** :

| Variante | Profil | Liens | Domaines visés |
|---|---|---|---|
| `link` | « Youkyi » (logo), 8 liens | LinkedIn, Instagram, Threads, X, YouTube, Facebook, GitHub, Mail | `youkyi.fr`, `link.youkyi.fr` |
| `pro` | « Alexandre Agasseau » (photo), 4 liens | LinkedIn, X, GitHub, Mail | `pro.youkyi.fr` |

## Architecture

```
config/<variant>.json   Contenu d'une variante (nom, bio, avatar, liste de liens, og)
data/networks.mjs       Map réseau -> { label, svg } (SVG inline)
src/templates/          layout.html (page) + error.html (404), avec {{placeholders}}
src/input.css           Tailwind source : cartes verre, classes de scène, avatar, 404
tailwind.config.js      Palette `brand`, content -> apps/ + templates
build/generate.mjs      Générateur (ESM, zéro dépendance) + réglages du fond (FROZEN_DC)
assets/                 Avatars (logo-youkyi.png, alexandre.jpg) + vendor/ (Three.js + datacenter.js)
apps/                   SORTIE GÉNÉRÉE (gitignorée) : apps/link, apps/pro
vercel.json             cleanUrls + en-têtes de sécurité (CSP, HSTS…) partagés
```

`apps/` et `assets/tailwind.css` sont **générés** (gitignorés), reconstruits par `npm run build` en local et sur Vercel. `assets/vendor/` (Three.js + moteur) est **versionné** et copié dans chaque variante au build.

## Le fond Datacenter 3D

- Moteur : `assets/vendor/datacenter.js` (adapté d'un design Claude). Allée de datacenter infinie : baies de serveurs texturées, rangées de LED clignotantes (shader), bloom, sol réfléchissant, brouillard. **Boucle infinie sans saut** (chaque baie est recyclée individuellement vers le fond). Voile + vignette pour la lisibilité du texte. **Fallback** : fond sombre simple si pas de WebGL.
- Three.js est **auto-hébergé** (`assets/vendor/three/…`) via un importmap local : aucun CDN, la CSP stricte (`script-src 'self'`) est respectée.
- Réglages : la config validée vit dans `FROZEN_DC` (`build/generate.mjs`) et est injectée en `window.DC_CONFIG`. Pour ré-explorer un réglage, ouvrir une page avec `window.DC_PANEL = true` (panneau live + « Copier la config »).

## Modifier le contenu

- **Ajouter / retirer / réordonner un lien** : éditer le tableau `links` de `config/link.json` ou `config/pro.json` (l'ordre du tableau = l'ordre d'affichage).
- **Nouveau réseau** : ajouter son entrée (libellé + SVG) dans `data/networks.mjs`, le référencer dans une config. Pour une icône colorée : `.is-<reseau> svg { color: #...; }` dans `src/input.css`.
- **Texte commun, styles, footer** : `src/templates/layout.html` et `src/input.css` (modifiés une seule fois pour les deux variantes).
- **Réglage du fond 3D** : `FROZEN_DC` dans `build/generate.mjs`.

## Build & développement local

```bash
npm install        # une fois
npm run build      # génère apps/link et apps/pro (HTML + CSS + avatars + vendor)
npm run watch      # surveille src/input.css pendant l'édition du CSS
npm run dev        # build + sert apps/link
```

Aperçu d'une variante : `npx serve apps/link` (ou `apps/pro`). Le fond 3D nécessite WebGL.

## Déploiement Vercel (2 projets, même dépôt)

Deux projets Vercel important ce dépôt, tous deux avec **Root Directory = racine** et **Build Command = `npm run build`** (fourni par `vercel.json`). Seul l'**Output Directory** diffère (réglé par projet dans le dashboard) :

| Projet Vercel | Output Directory | Domaines |
|---|---|---|
| `youkyi-link` | `apps/link` | `youkyi.fr`, `link.youkyi.fr` |
| `youkyi-pro`  | `apps/pro`  | `pro.youkyi.fr` |

`vercel.json` (partagé) fournit `cleanUrls` et les en-têtes de sécurité (CSP, HSTS, X-Frame-Options). La CSP autorise les modules/importmap en `'self'` ; Three.js n'utilise pas `eval`, donc pas besoin de `'unsafe-eval'`.

## Analytics

Aucun analytics pour l'instant : les scripts Vercel (Speed Insights / Web Analytics) ont été retirés. Un outil d'analytics propre pourra être ajouté plus tard.

## Conventions

- Toujours en **français**, orthographe et accents corrects.
- Jamais de tiret cadratin (em-dash U+2014).
- **Thème sombre unique** (plus de bascule clair/sombre) ; `<html class="dark">` est forcé.
- Commits sans `Co-Authored-By`, en français, format conventionnel (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `build:`).
