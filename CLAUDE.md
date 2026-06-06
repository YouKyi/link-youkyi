# link-youkyi - Pages de liens YouKyi (link in bio)

Monorepo statique **data-driven** générant deux pages « link in bio » de **YouKyi**, avec un **fond 3D animé de datacenter** (Three.js), déployées sur Vercel. Le contenu n'est PAS hardcodé : il est décrit en JSON et un script Node génère le HTML.

Deux variantes, une source unique, **thème sombre uniquement** :

| Variante | Profil | Liens | Domaines |
|---|---|---|---|
| `link` | « Youkyi » (logo), 8 liens | sombre | `youkyi.fr`, `link.youkyi.fr` |
| `pro` | « Alexandre Agasseau » (photo), 4 liens | sombre | `pro.youkyi.fr` |

## Structure des fichiers

```
config/<variant>.json   Contenu d'une variante (title, name, bio, avatar, footer, og, links[])
data/networks.mjs       Map réseau -> { label, svg } (SVG inline, fill="currentColor")
src/templates/
  layout.html           Page avec {{PLACEHOLDERS}} (dont {{DC_CONFIG}} = réglages du fond)
  error.html            Page 404 (classes .error-*, pas d'inline -> CSP stricte)
src/input.css           Tailwind : .link-card(-featured) (cartes verre), .link-icon, .link-label,
                        .is-<reseau> svg (couleurs marque), .avatar*, .scene-* (fond), .error-*
tailwind.config.js      Palette `brand`, content -> apps/ + templates + data
build/generate.mjs      Générateur (ESM, zéro dépendance) ; FROZEN_DC = réglages du fond 3D
assets/                 Avatars versionnés + vendor/ (Three.js auto-hébergé + datacenter.js)
apps/                   SORTIE GÉNÉRÉE (gitignorée) : apps/link, apps/pro
vercel.json             cleanUrls + en-têtes de sécurité (partagés)
```

`apps/` et `assets/tailwind.css` sont **générés** (gitignorés). `assets/vendor/` est **versionné** (Three.js ~1,3 Mo + moteur). Ne pas éditer `apps/` à la main : éditer la source puis rebuild.

## Le générateur (`build/generate.mjs`)

Pour chaque variante (`['link','pro']`) :
1. Lit `config/<variant>.json`.
2. Construit le HTML des liens via `data/networks.mjs` (SVG) ; classe `is-<network>` pour la couleur. `featured:true` -> carte mise en avant (`.link-card-featured`, étoile, titre violet + sous-titre).
3. Remplit `layout.html` et `error.html` (remplacement `{{CLE}}`). `{{DC_CONFIG}}` reçoit `cfg.dc || FROZEN_DC` (injecté en `window.DC_CONFIG`).
4. Écrit `apps/<variant>/{index.html,404.html}` et copie l'avatar + `assets/vendor/` (Three.js + moteur) + `assets/tailwind.css` dans `apps/<variant>/assets/`.

`--copy-css` : (re)copie seulement les assets dans les apps (étape finale du build, après Tailwind).

## Le fond Datacenter 3D (`assets/vendor/datacenter.js`)

- Three.js + addons (EffectComposer/UnrealBloom/Reflector) **auto-hébergés** sous `assets/vendor/three/`, résolus par un importmap local (`'three'`, `'three/addons/'`). CSP `script-src 'self'` OK (Three.js n'utilise pas `eval`).
- Scène : allée de datacenter infinie, LED clignotantes (THREE.Points + shader), bloom, sol réfléchissant, brouillard. **Boucle infinie sans saut** : chaque baie est recyclée individuellement vers le fond (`u.position.z -= TUNNEL`), pas de remise à zéro globale.
- Lisibilité : `<div id="veil">` (réglé par le moteur) + `.scene-vignette`. **Fallback** : si pas de WebGL, fond sombre simple.
- Réglable : `window.DC_CONFIG` (la prod) ; `window.DC_PANEL = true` affiche le panneau live (sliders + « Copier la config »). API exposée : `window.DC`.

## Anatomie d'une carte de lien

- **Carte standard** : `<a class="link-card group">` + `<span class="link-icon is-<network>">SVG</span>` + libellé (`.link-label`) + chevron (CSS `::after`). Sous-titre : envelopper dans `<span class="flex flex-col">`.
- **Carte « featured »** (Mail) : `<a class="link-card-featured group">`, étoile, titre violet (`text-brand-primary`) + sous-titre (email).
- **Cartes « verre »** : fond translucide + `backdrop-filter` (glassmorphism), posées sur le fond 3D. Icônes de marque colorées via `.is-<network> svg { color: … }` ; monochromes (X, GitHub, Threads) en blanc.

## Build

`apps/**` et `assets/tailwind.css` sont **compilés**. Tailwind scanne `apps/**/*.html` (générés AVANT la compilation), donc l'ordre du build importe.

```bash
npm install
npm run build      # generate -> tailwind --minify -> copy assets (les deux variantes)
npm run watch      # surveille src/input.css
npm run dev        # build + sert apps/link
```

Sur Vercel, la build se relance à chaque push (`vercel.json`).

## Déploiement Vercel (2 projets, même dépôt)

Deux projets, **Root Directory = racine**, **Build Command = `npm run build`**. Seul l'**Output Directory** diffère (dashboard) :
- `youkyi-link` -> `apps/link` -> `youkyi.fr`, `link.youkyi.fr`
- `youkyi-pro`  -> `apps/pro`  -> `pro.youkyi.fr`

`vercel.json` partagé (pas de `outputDirectory` dedans). CSP stricte conservée (`img-src 'self' data:`, `script-src 'self' 'unsafe-inline'`).

## Conventions

- Toujours en **français**, orthographe et accents corrects.
- Jamais de tiret cadratin (em-dash U+2014) : virgules, deux-points, parenthèses ou phrases séparées.
- **Thème sombre unique** : `<html class="dark">` forcé, plus de bascule ni de détection clair/sombre.
- Pas d'analytics pour l'instant : les scripts Vercel (Speed Insights / Web Analytics) ont été retirés. Analytics maison plus tard.

## Git

- **Ne jamais** ajouter de ligne `Co-Authored-By` (ni aucune mention d'auteur ajouté). Au seul nom de l'utilisateur.
- Messages de commit en français, format conventionnel (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `build:`), sans em-dash. Commits **atomiques** (un changement logique par commit).
