# link-youkyi - Pages de liens YouKyi (link in bio)

Monorepo statique **data-driven** générant deux pages « link in bio » de **YouKyi**, avec un **fond 3D animé de datacenter** (Three.js), déployées sur Vercel. Le contenu n'est PAS hardcodé : il est décrit en JSON et un script Node génère le HTML.

Deux variantes, une source unique, **thème sombre uniquement** :

| Variante | Profil | Liens | Domaines |
|---|---|---|---|
| `link` | « youkyi » (logo officiel), 9 liens | sombre | `youkyi.fr`, `link.youkyi.fr` |
| `pro` | « Alexandre Agasseau » (photo), 5 liens | sombre | `pro.youkyi.fr` |

## Structure des fichiers

```
config/<variant>.json   Contenu d'une variante (title, name, bio, avatar, footer, og, links[])
data/networks.mjs       Map réseau -> { label, svg } (SVG inline, fill="currentColor")
src/templates/
  layout.html           Page avec {{PLACEHOLDERS}} (dont {{DC_CONFIG}} = réglages du fond)
  error.html            Page 404 (classes .error-*, pas d'inline -> CSP stricte)
src/input.css           Adaptations des composants officiels : .profile-*, .link-card(-featured),
                        .link-icon, .avatar, .scene-* (fond), .error-*
postcss.config.cjs       Regroupe le kit CSS et conserve les URL locales de ses fontes
tailwind.config.js      Content -> apps/ + templates + data
build/generate.mjs      Générateur (ESM, zéro dépendance), importe SCENE_DEFAULTS
assets/                 Avatars versionnés + poster-<variant>.webp (optionnels) + vendor/ (Three.js
                        auto-hébergé + moteur du fond : datacenter.js, dc-layout.mjs, dc-racks.js, dc-textures.js, dc-panel.js)
apps/                   SORTIE GÉNÉRÉE (gitignorée) : apps/link, apps/pro
vercel.json             cleanUrls + en-têtes de sécurité (partagés)
```

`apps/` et `assets/tailwind.css` sont **générés** (gitignorés). `assets/vendor/` est **versionné** (Three.js ~1,3 Mo + moteur). Ne pas éditer `apps/` à la main : éditer la source puis rebuild.

## Le générateur (`build/generate.mjs`)

Pour chaque variante (`['link','pro']`) :
1. Lit `config/<variant>.json`.
2. Construit le HTML des liens via `data/networks.mjs` (couleurs via `.is-<network>`) et les pictogrammes du kit officiel. `featured:true` -> contact en verre avec titre blanc et enveloppe orange (`.link-card-featured`), sans flèche. Les autres liens ont le chevron d'origine « › », masqué aux lecteurs d'écran.
3. Remplit `layout.html` et `error.html` (remplacement `{{CLE}}`). `{{DC_CONFIG}}` reçoit `cfg.dc || SCENE_DEFAULTS` (injecté en `window.DC_CONFIG`).
4. Écrit `apps/<variant>/{index.html,404.html}` et copie l'avatar + `assets/vendor/` (Three.js + moteur) + `assets/tailwind.css` dans `apps/<variant>/assets/`.

`--copy-css` : (re)copie seulement les assets dans les apps (étape finale du build, après Tailwind).

## Le fond Datacenter 3D (`assets/vendor/`)

- Deux rendus : `graphite` (façades, portes et montants) et `hardware` (châssis, tiroirs SFF/LFF, grilles, vis, ports et cordons en 3D jusqu'à 16 m, mêmes façades au-delà). `?render=hardware` sélectionne B, y compris sur les pages générées.
- `dc-layout.mjs` porte `SCENE_DEFAULTS`, les huit implantations 42U et les positions des pièces/LED. `dc-racks.js` fusionne les pièces par matériau et les instancie en conservant les index et les sommets partagés. `dc-textures.js` dessine les atlas. `datacenter.js` assemble la scène, gère la caméra, le rendu et le repli ; les huit implantations de LED et les trois couleurs sont réutilisées. `dc-panel.js` est chargé seulement dans le tuner.
- Chaque baie contient trois couples switch/panneau de brassage : un 24 RJ45 + 2 SFP vers le milieu, deux 48 RJ45 + 4 SFP en haut. Leurs façades claires et afficheurs sont communs aux deux rendus ; B ajoute les prises creuses et les cordons. Garder l'ordre switch/panneau pour brancher les câbles sur les ports correspondants.
- Deux périodes identiques ; caméra ramenée d'une période pour le travelling continu. Reflets par géométrie inversée sous le sol satiné, avec winding corrigé (pas d'échelle négative sur les instances).
- Matériaux graphite, environnement PMREM local, rampes, bloom, brouillard, poussière et voyants alignés sur les équipements : activité indépendante des disques/ports, alimentation fixe. La scène HDR utilise une cible MSAA jusqu'à 4×, résolue par CopyShader avant le bloom qui réécrit sa texture d'entrée. Les cibles de post-traitement n'allouent pas de profondeur ; la cible de la scène conserve la sienne. Conserver le clamp avant `pow(vRim, 1.6)` dans le shader des faisceaux : les valeurs négatives extrapolées aux arêtes produisaient des NaN et des rectangles noirs avec le MSAA. Mélange vérifié sur GPU Apple M5.
- Réglages : `SCENE_DEFAULTS`, surchargés par `window.DC_CONFIG` depuis `cfg.dc`. API `window.DC` pour appliquer les réglages, changer de rendu, pauser, réinitialiser le point de vue et capturer le poster.
- `npm run tune` sert `tuner.html` : comparaison A/B, pause, retour au départ, vue rapprochée, réglages, export. La vue rapprochée fige le déplacement mais conserve les animations. `&profile=pro` charge les réglages professionnels. Les statistiques comptent toute l'image ; les millisecondes affichées mesurent la préparation et la soumission CPU, pas le GPU. `capturePoster(false)` renvoie le Blob sans téléchargement.
- Posters versionnés : `poster-{link,pro}.webp` et `poster-hardware-{link,pro}.webp`, copiés dans chaque variante. Un script léger choisit et précharge le bon poster avant le CSS. Repli au chargement, sans WebGL et en réduction des mouvements. Dans ce dernier cas, les pages publiques ne téléchargent aucun module 3D ; elles le chargent si la préférence change. Démarrage après `load` + `requestIdleCallback`, arrêt dans un onglet masqué, une image par rafraîchissement du navigateur. Résolution plafonnée à 2560 × 1600 et DPR 2.
- Three.js r160 et addons auto-hébergés sous `assets/vendor/three/`, importmap local. Aucun modèle ou texture distant.
- `npm test` vérifie notamment les 42U, les limites des pièces et voyants, le raccord des deux sections et le cadrage portrait. Valider aussi A/B dans le navigateur après toute modification de géométrie ou de post-traitement.

## Identité et liens

- `src/input.css` importe `assets/vendor/youkyi-brand/styles.css` (design system officiel 2.0.2, dépôt youkyi-brand v2.1.1) avant les styles locaux. PostCSS regroupe le tout en une feuille minifiée et réécrit les URL des fontes, avec les dépendances déjà fournies par Tailwind. Garder les fichiers du kit intacts ; les adaptations vivent dans `src/input.css`.
- **Choix explicite d'Alexandre** : conserver le glassmorphism et ajouter seulement des touches orange. Les surfaces mates et le gros bouton orange ont été rejetés. Cette préférence prime sur les composants mats du kit officiel.
- **Carte standard** : lien `.link-card`, icône en verre avec couleur de réseau, libellé et chevron d'origine « › » de 20 px. Fond à 28 % d'opacité, flou de 14 px et reflets légers. Filet et chevron orange au survol.
- **Contact principal** : lien `.link-card-featured`, mêmes marges et verre que les autres cartes, petite enveloppe orange dans le même cadre d'icône, titre blanc et adresse en dessous, sans flèche. Focus orange de 2 px décalé de 2 px ; aucun aplat orange. Le libellé public est « Écrivez-moi ».
- **Identité** : lockup B scellé sur `link`, portrait et signature officielle sur `pro`, favicon et aperçu de partage officiels. Alexandre a demandé de restaurer la police système d'origine de `link` (pile sans-serif par défaut de Tailwind). IBM Plex Mono reste uniquement dans le diagnostic 404. Le logo vectorisé reste intact.
- La scène 3D animée conserve ses deux rendus. Une paire de rampes sur quatre porte l'accent orange, reflets compris, avec un éclairage latéral légèrement chaud. Garder le cycle raccordé aux deux sections du tunnel. Les voyants conservent leurs couleurs techniques.
- `npm test` reconstruit les pages et vérifie leurs destinations, les attributs des liens, le contact unique, les SVG officiels et la présence des assets locaux, en plus des contrôles de scène.

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
