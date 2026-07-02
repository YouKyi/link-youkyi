# Design : rework réaliste du fond datacenter 3D

Date : 2026-07-02
Statut : validé (brainstorming avec Alexandre)

## Contexte et objectif

Le fond 3D actuel (`assets/vendor/datacenter.js`, 354 lignes) affiche une allée
infinie de baies serveur : caissons sombres, faces texturées en canvas
procédural, LED clignotantes (THREE.Points + shader), sol miroir (Reflector),
bloom, brouillard. Il se lit comme « des boxes noires avec des loupiotes ».

Objectif : un rendu nettement plus réaliste sur les quatre axes (éclairage,
géométrie, atmosphère, vie), **à budget GPU constant** (~6 %, 30 fps, rendu
plafonné 1080p). Approche retenue : 3D temps réel optimisée + poster statique
en fallback (approche C du brainstorming).

Décision associée : la piste « convertir le fond en vidéo » est rejetée
(artefacts de compression sur scène sombre à LED, poids réseau 4-20 Mo contre
~350 Ko de Three.js gzippé, perte du tuner, du seed aléatoire et de
l'adaptation au ratio d'écran).

## Contraintes

- Budget GPU identique à l'actuel (~6 %) ; 30 fps et plafond 1080p conservés.
- CSP `script-src 'self'` : Three.js auto-hébergé, importmap local, aucune
  dépendance externe ni CDN.
- Voile (`veil` 0.32) et vignette inchangés : la lisibilité des cartes prime.
- Identité violette YouKyi : palettes `violet` (link) et `violetPremium` (pro)
  conservées.
- Boucle infinie sans saut conservée (recyclage individuel vers le fond).
- Le tuner (`tuner.html` + `npm run tune`) reste l'outil de réglage.

## Section 1 : architecture et optimisations (financent le réalisme)

### Suppression du Reflector

Le `Reflector` re-rend toute la scène dans une render target à chaque frame
(~40-50 % du coût GPU actuel). Il est remplacé par un **monde miroir** : les
mêmes instances (baies, LED, rampes) dupliquées avec `scale.y = -1` sous le
plan du sol, atténuées par un plan sombre semi-transparent posé dessus et par
le brouillard. Tout est rendu dans la même passe : le reflet signature reste,
son coût devient marginal.

### Instancing et atlas

- Les 68 baies (caisson + face + poignée chacune, ~200 draw calls) passent en
  `InstancedMesh` : un par famille (caissons, faces, montants, rampes, shafts,
  chemins de câbles), soit ~6-8 draw calls pour toute la structure répétée.
  Le miroir ajoute des instances, pas de draw calls. Avec les éléments uniques
  (LED, sol, plafond, poussière, écrans, fond de tunnel), la scène complète
  vise ~15 draw calls.
- Les faces avant utilisent un **atlas de textures** : une seule grande
  texture canvas contenant 8 façades différentes, sélection par offset UV par
  instance (`InstancedBufferAttribute` + patch de shader via
  `onBeforeCompile`). Un seul matériau au lieu de 6.
- Recyclage : au wrap, seule la matrice de l'instance concernée est réécrite
  (`instanceMatrix.needsUpdate`), coût CPU négligeable.

### Découpage du moteur

`assets/vendor/datacenter.js` est scindé en 3 modules ESM (importmap local,
CSP-safe), copiés en bloc par `generate.mjs` comme aujourd'hui (copie du
dossier `assets/vendor/` entier) :

- `datacenter.js` : config, scène, boucle d'animation, recyclage, fallback.
- `dc-textures.js` : tout le canvas procédural (façades, sol, écrans, atlas).
- `dc-panel.js` : le panneau du tuner.

`layout.html`, `error.html` et `tuner.html` ne référencent toujours que
`datacenter.js`.

## Section 2 : le réalisme, axe par axe (tout est cuit ou simulé)

Aucune lumière dynamique, aucune passe de rendu supplémentaire.

### Éclairage

- **Rampes LED au plafond** : boîtes fines émissives blanc-bleuté, une toutes
  les 2 baies (espacement 4.8 = diviseur du tunnel 81.6, pour un recyclage
  sans couture), instanciées et recyclées comme les baies. Le bloom existant
  crée le halo.
- **Pools de lumière au sol** : cuits dans la texture du sol avec les dalles
  de plancher technique (grille 60x60, joints, perforations). Le sol reste un
  plan fixe : sa texture défile par offset UV au rythme exact de `camSpeed`,
  période alignée sur l'espacement des rampes.
- **Modulation d'éclairage des baies** : dans le shader des faces (patch
  `onBeforeCompile`), la luminosité monte sous une rampe et redescend entre
  deux (sinusoïde de période = espacement des rampes). Point d'implémentation
  critique : la phase se calcule dans le référentiel de l'allée qui défile
  (position Z monde + offset de défilement cumulé, uniform `uScroll` partagé,
  le même qui anime l'offset UV du sol), pas en Z monde brut, sinon les pools
  de lumière glisseraient sur les baies au lieu de rester accrochés aux
  rampes. C'est le détail qui « vend » l'éclairage.
- **Fond de tunnel** : plan émissif discret dans le brouillard (lueur de fin
  d'allée).

### Atmosphère

- **Faux volumétrique** : cône ouvert additif sous chaque rampe (dégradé
  radial cuit dans une petite texture, `depthWrite: false`), le light-shaft
  classique de jeu vidéo. Instancié, recyclé.
- **Poussière** : ~300 THREE.Points additifs concentrés sous les shafts,
  dérive lente + défilement ; le recyclage se fait par modulo dans le vertex
  shader (zéro CPU). Un draw call.

### Géométrie

- **Faces renfoncées** : la façade recule de ~8 cm dans le caisson, montants
  avant en géométrie réelle (instanciés). Vue de biais (bords de l'écran), la
  profondeur des baies devient réelle.
- **Chemins de câbles** : rail ajouré au plafond avec faisceaux de câbles
  low-poly posés dessus, instanciés et recyclés.

### Vie

- **Textures de façades** : résolution doublée (1024x2048), 8 variantes dans
  l'atlas, enrichies : portes grillagées à perforations hexagonales, occlusion
  ambiante cuite, arcs de câbles patch colorés entre ports, étiquettes,
  U-numbers sur les montants.
- **Écrans de monitoring** : ~1 baie sur 8 porte un petit plan émissif dont la
  texture « logs terminal » (canvas procédural) défile par offset UV.
- **LED « trafic réseau »** : le shader LED gagne un mode rafales irrégulières
  (mix de deux fréquences + hash) mêlé aux clignotements sinusoïdaux actuels.

## Section 3 : fallback, tuner, mesure

### Poster statique (approche C)

- Bouton « Exporter poster » dans le tuner : capture le canvas en WebP,
  téléchargé puis versionné dans `assets/`. Deux posters, un par variante
  (`poster-link.webp` avec la palette `violet`, `poster-pro.webp` avec
  `violetPremium`), copiés par `generate.mjs` comme les avatars.
- Sur les pages : le poster s'affiche immédiatement (CSS, sous le canvas), le
  moteur démarre en différé (après l'événement `load`), le canvas apparaît en
  fondu une fois la première frame rendue.
- Si `prefers-reduced-motion` ou WebGL indisponible : le moteur ne démarre
  pas, le poster reste. Le fallback actuel (dégradé sombre) devient le filet
  ultime si le poster manque.

### Tuner enrichi

- Nouveau groupe « Éclairage » : intensité des rampes, intensité des shafts,
  densité de poussière, activité des écrans, reflet on/off.
- Compteur ms/frame affiché dans le panneau (mesure objective avant/après).
- Les nouvelles clés rejoignent `DEFAULTS` et « Copier la config » ;
  `FROZEN_DC` (build/generate.mjs) et le bloc `dc` de `config/pro.json` seront
  mis à jour avec les configs validées au tuner.

### Vérification

1. Mesure du frame time au tuner avant/après (objectif : inférieur ou égal à
   l'actuel à réglages par défaut).
2. Contrôle visuel : tuner, `apps/link`, `apps/pro`, page 404.
3. Test des fallbacks : émulation `prefers-reduced-motion`, WebGL désactivé.
4. `npm run build` complet : génération, Tailwind, copie des assets, pages
   servies localement.

## Hors périmètre

- Vidéo pré-rendue (rejetée, cf. contexte).
- Vraies lumières dynamiques, ombres portées, profondeur de champ, SSR.
- Modèles 3D externes (GLTF) : tout reste procédural et auto-hébergé.
- Analytics, contenu des pages, thème clair.
