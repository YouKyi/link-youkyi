# OcciClean - Page de liens (link in bio)

Page statique « link in bio » d'**OcciClean** (nettoyage automobile à domicile, Toulouse & Occitanie), déployée sur Vercel. HTML statique + Tailwind CSS compilé. Pas de framework JS, pas de build d'application : juste du HTML et une feuille Tailwind générée.

## Structure des fichiers

```
index.html            Page principale : toutes les cartes de liens
404.html              Page d'erreur 404 (servie par Vercel)
src/input.css         Source Tailwind (directives @tailwind + composants @apply)
tailwind.config.js    Config Tailwind (couleurs de marque `brand`, dark mode par classe)
assets/tailwind.css   CSS COMPILÉ et minifié (généré par la build, référencé par les pages)
assets/logo.png       Logo OcciClean (favicon + en-tête)
package.json          Scripts de build Tailwind
vercel.json           Build + cleanUrls côté Vercel
```

## Anatomie d'une carte de lien (`index.html`)

Les liens sont du **HTML hardcodé**, il n'y a aucune structure de données ni génération. Deux modèles de carte :

- **Carte standard** : `<a class="link-card group">` contenant un `<span class="link-icon">` (SVG inline) puis le libellé. Pour un libellé avec sous-titre, on enveloppe les deux spans dans un `<span class="flex flex-col">` :
  ```html
  <span class="flex flex-col">
      <span class="link-label">Instagram</span>
      <span class="text-xs text-slate-500 dark:text-slate-400">Les actualités OcciClean</span>
  </span>
  ```
- **Carte « featured »** (site web) : `<a class="link-card-featured group">`, mise en avant (bordure épaisse, fond teinté, étoile), avec titre + sous-titre.

Cartes présentes : Site web (featured), Email (devis), Facebook, Instagram, TikTok.

## Styles de carte (`src/input.css`, layer `components`)

`.link-card`, `.link-card-featured`, `.link-icon`, `.link-label` sont définis avec `@apply`. Les couleurs de marque viennent de `tailwind.config.js` (clé `brand` : `primary`, `light`, `accent`, `bg`, `darkBg`).

## Build (régénérer le CSS)

`assets/tailwind.css` est **compilé**. Toute classe utilitaire utilisée dans `index.html`/`404.html` doit exister dans ce fichier, sinon elle n'a aucun effet. Si on ajoute une classe Tailwind **déjà employée ailleurs** dans le HTML, le rebuild est inutile. Si on introduit une **nouvelle** classe, régénérer :

```bash
npm install        # une fois
npm run build      # génère assets/tailwind.css minifié
npm run watch      # mode surveillance pendant l'édition
```

Sans Node : `.\tools\tailwindcss.exe -i .\src\input.css -o .\assets\tailwind.css --minify` (binaire non versionné).

Sur Vercel, la build se relance automatiquement à chaque push (`vercel.json`).

## Prévisualiser

Ouvrir `index.html` dans le navigateur, ou `python -m http.server 8000` puis http://localhost:8000.

## Conventions

- Toujours en **français**, orthographe et accents corrects.
- Jamais de tirets cadratins (em-dash U+2014) : virgules, deux-points, parenthèses ou phrases séparées.
- Le dark mode est piloté par la classe `dark` sur `<html>` (script inline en bas d'`index.html`, persistance via `localStorage.theme`). Toute couleur doit avoir sa variante `dark:`.

## Analytics Vercel

Speed Insights + Web Analytics sont intégrés via des **balises `<script>`** dans `index.html` et `404.html` (méthode HTML pure de Vercel), pas via le package npm `@vercel/*` : il n'y a pas de bundler pour `import` un module ici. Les scripts sont servis automatiquement par Vercel depuis `/_vercel/speed-insights/script.js` et `/_vercel/insights/script.js` une fois les fonctionnalités activées dans le dashboard. Ne pas tenter d'installer `@vercel/speed-insights` ou `@vercel/analytics`. Les métriques n'apparaissent qu'après déploiement sur Vercel (pas en local).

## Git

- **Ne jamais** ajouter de ligne `Co-Authored-By` (ni aucune mention d'auteur ajouté) dans les messages de commit. Les commits doivent rester au seul nom de l'utilisateur.
- Messages de commit en français, format conventionnel (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`), sans em-dash.
