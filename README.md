# OcciClean - Page de liens

Page « link in bio » statique d'OcciClean (HTML + Tailwind CSS compilé), prête à déployer sur Vercel.

## Structure

```
index.html            Page principale (les liens)
404.html              Page d'erreur 404 (servie par Vercel)
src/input.css         Source Tailwind (directives + composants @apply)
tailwind.config.js    Configuration Tailwind (couleurs de marque, dark mode)
assets/tailwind.css   CSS COMPILÉ (généré par la build, référencé par les pages)
package.json          Scripts de build
vercel.json           Build automatique côté Vercel
```

## Développement local

### Avec Node.js (recommandé)

```bash
npm install
npm run build      # génère assets/tailwind.css
# ou, en mode surveillance pendant l'édition :
npm run watch
```

### Sans Node.js (binaire standalone)

Le binaire Tailwind autonome (Windows) est dans `tools/tailwindcss.exe` (non versionné).

```powershell
.\tools\tailwindcss.exe -i .\src\input.css -o .\assets\tailwind.css --minify
```

### Prévisualiser

Une fois `assets/tailwind.css` généré, ouvrir simplement `index.html` dans le navigateur
(double-clic), ou servir le dossier :

```bash
python -m http.server 8000
# puis http://localhost:8000
```

## Déploiement Vercel

Le dépôt est prêt à l'emploi :

- `vercel.json` indique à Vercel de lancer `npm run build` puis de servir la racine.
- `404.html` à la racine est automatiquement utilisée comme page d'erreur.
- `cleanUrls` masque les extensions `.html`.

Importer le dépôt sur Vercel (Framework Preset : **Other**) et déployer, aucune autre
configuration n'est nécessaire.

## Modifier les liens / couleurs

- Liens, textes : éditer `index.html`.
- Couleurs de marque : `tailwind.config.js` (clé `brand`), puis relancer la build.
- Styles de carte réutilisables : `.link-card`, `.link-card-featured`, `.link-icon`,
  `.link-label` dans `src/input.css`.

> Après toute modification des classes, régénérer `assets/tailwind.css` (voir ci-dessus).
> Sur Vercel, la build se relance automatiquement à chaque push.
