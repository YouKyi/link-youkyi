# Fond datacenter réaliste : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le fond 3D datacenter nettement plus réaliste (éclairage, profondeur, atmosphère, vie) à budget GPU constant, avec poster statique en fallback.

**Architecture:** Le Reflector (sol miroir, ~40-50 % du coût GPU) est remplacé par un monde miroir instancié rendu dans la même passe. Le monde devient entièrement statique (2 périodes de tunnel), la caméra avance et se téléporte d'une période quand elle l'a parcourue (wrap invisible). Le réalisme est cuit : atlas de façades procédurales, rampes émissives, pools de lumière dans la texture du sol, modulation d'éclairage en shader, faux volumétrique additif, poussière, écrans de logs.

**Tech Stack:** Three.js auto-hébergé (importmap local, `assets/vendor/three/`), Canvas 2D procédural, ESM sans dépendance, Tailwind pour le CSS des pages.

**Spec :** `docs/superpowers/specs/2026-07-02-fond-datacenter-realiste-design.md`

## Global Constraints

- CSP `script-src 'self'` : aucun CDN, aucun `eval`, importmap local uniquement.
- Budget GPU final ≤ budget actuel (~6 %, mesuré via ms/frame du tuner + Chrome Task Manager). 30 fps et plafond de rendu 1080p conservés.
- `veil` par défaut reste 0.32 ; vignette et lisibilité des cartes inchangées.
- Palettes `violet` (link) et `violetPremium` (pro) conservées telles quelles.
- Boucle infinie sans saut visible.
- Aucun framework de test JS dans ce repo : chaque tâche se vérifie par `node --check`, le tuner (http://localhost:4173/tuner, serveur : `npx --yes serve -l 4173 .` depuis la racine), le compteur ms/frame + draw calls du panneau, et `npm run build`.
- Node : `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (npm absent du PATH par défaut sur cette machine).
- Textes/commentaires en français, sans tiret cadratin. Commits atomiques en français (`feat:`, `fix:`, `refactor:`, `perf:`, `docs:`), **jamais** de ligne `Co-Authored-By`.
- Ne jamais éditer `apps/**` (généré). Sources : `assets/vendor/`, `src/`, `build/`, `config/`.

**Écarts au spec (assumés, plus simples à coût égal) :**
1. Le spec évoque un sol qui « suit la caméra avec offset UV compensé » ; le plan utilise un sol statique long de 2 périodes avec texture répétée, strictement équivalent visuellement et sans aucune animation d'offset.
2. Les poignées de porte actuelles (`handleGeo`) disparaissent au profit des montants avant instanciés, qui donnent la même rupture de silhouette en mieux.

**État initial attendu :** working tree propre sur `main` à partir du commit `74cb001` (spec amendé). `assets/vendor/` et `build/generate.mjs` présents (restaurés). Le moteur actuel est `assets/vendor/datacenter.js` (354 lignes) : lire ce fichier EN ENTIER avant la tâche 1.

---

### Task 1 : Scinder le moteur en 3 modules + instrumentation perf

Aucun changement visuel. On prépare le terrain et on pose l'outil de mesure qui servira de référence pour toutes les tâches suivantes.

**Files:**
- Create: `assets/vendor/dc-textures.js` (canvas procédural)
- Create: `assets/vendor/dc-panel.js` (panneau tuner)
- Modify: `assets/vendor/datacenter.js` (imports + stats)

**Interfaces:**
- Produces: `dc-textures.js` exporte `mulberry32(seed)`, `drawScrew(x, cx, cy)`, `drawUnit(x, ox, oy, w, h, rnd)`, `makeRackTexture(seed)`, `makeServerTexture(seed)` (signatures identiques aux fonctions actuelles de datacenter.js).
- Produces: `dc-panel.js` exporte `buildPanel(ctx)` avec `ctx = { config, DEFAULTS, applyLive, buildLEDs, regen, getStats }`.
- Produces: `datacenter.js` expose `window.DC.stats = { ms, calls }` mis à jour chaque frame.

- [ ] **Step 1 : Créer `assets/vendor/dc-textures.js`**

Déplacer (couper-coller à l'identique depuis `datacenter.js`) les fonctions `mulberry32`, `drawScrew`, `drawUnit`, `makeRackTexture`, `makeServerTexture`, avec en tête :

```js
/* Textures procédurales du fond datacenter (canvas 2D -> CanvasTexture).
   Zéro dépendance hors Three.js. */
import * as THREE from 'three';

export function mulberry32(s){ /* ...code actuel inchangé... est déplacé ici */ }
export function drawScrew(x, cx, cy){ /* idem */ }
export function drawUnit(x, ox, oy, w, h, rnd){ /* idem */ }
export function makeRackTexture(sd){ /* idem */ }
export function makeServerTexture(sd){ /* idem */ }
```

Le contenu des fonctions est copié tel quel depuis `datacenter.js` lignes 20, 82-154 (ne PAS le retaper de mémoire : copier).

- [ ] **Step 2 : Créer `assets/vendor/dc-panel.js`**

Déplacer `buildPanel` (lignes 304-346 actuelles) en le paramétrant :

```js
/* Panneau de réglage (tuner) du fond datacenter. Chargé seulement si window.DC_PANEL. */
export function buildPanel(ctx){
  const { config, DEFAULTS, applyLive, buildLEDs, regen, getStats } = ctx;
  const controls = document.getElementById('controls'); if(!controls) return;
  // ... corps actuel de buildPanel, avec ces remplacements :
  //   - `config[def.key]=...` etc. inchangés (config est une référence partagée)
  //   - le bouton regen appelle ctx.regen() au lieu de manipuler seed directement
  //   - « Copier la config » inchangé (utilise DEFAULTS + config)
  // AJOUT en fin de fonction : ligne de perf, rafraîchie 2 fois par seconde
  const perf = document.createElement('div');
  perf.style.cssText = 'margin-top:10px;font-size:11px;color:#9a92ad;font-variant-numeric:tabular-nums;';
  controls.appendChild(perf);
  setInterval(() => { const s = getStats(); perf.textContent = `${s.ms.toFixed(2)} ms/frame (CPU) · ${s.calls} draw calls`; }, 500);
}
```

- [ ] **Step 3 : Adapter `assets/vendor/datacenter.js`**

En tête, remplacer les fonctions déplacées par :

```js
import { mulberry32, makeRackTexture, makeServerTexture } from './dc-textures.js';
```

Ajouter l'objet stats et la mesure autour du rendu dans `animate()` :

```js
const stats = { ms: 0, calls: 0 };
// dans animate(), remplacer `composer.render();` par :
const tA = performance.now();
composer.render();
stats.ms += (performance.now() - tA) * 0.05 - stats.ms * 0.05;   // EMA
stats.calls = renderer.info.render.calls;
```

Remplacer l'appel `if(window.DC_PANEL) buildPanel();` par un import dynamique (le panneau n'est jamais chargé en prod) :

```js
if (window.DC_PANEL) import('./dc-panel.js').then(m => m.buildPanel({
  config, DEFAULTS, applyLive, buildLEDs,
  regen(){ seed = Math.floor(Math.random()*1e9); buildLEDs(); },
  getStats(){ return stats; }
}));
```

Exposer `stats` dans `window.DC` (`window.DC = { ..., stats }`).

Note : la mesure ms/frame est côté CPU (le GPU est asynchrone) ; c'est un proxy. La vérité terrain reste le % GPU du Gestionnaire de tâches de Chrome. Les deux seront relevés à chaque jalon.

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `node --check assets/vendor/datacenter.js && node --check assets/vendor/dc-textures.js && node --check assets/vendor/dc-panel.js && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`

- [ ] **Step 5 : Vérifier au tuner (baseline)**

Serveur : `npx --yes serve -l 4173 .` (s'il ne tourne pas déjà). Ouvrir http://localhost:4173/tuner : rendu strictement identique à avant, panneau fonctionnel (sliders, palettes, copier). **Noter la valeur ms/frame et draw calls affichées : c'est la BASELINE**, l'écrire dans le message de commit.

- [ ] **Step 6 : Commit**

```bash
git add assets/vendor/datacenter.js assets/vendor/dc-textures.js assets/vendor/dc-panel.js
git commit -m "refactor: scinde le moteur du fond en 3 modules + compteur ms/frame (baseline: X.XX ms, N draw calls)"
```

---

### Task 2 : Monde statique, caméra qui avance et wrap

Le recyclage par baie disparaît. Le monde couvre 2 périodes de tunnel ; la caméra parcourt une période puis se téléporte en arrière, invisible car la scène est exactement périodique.

**Files:**
- Modify: `assets/vendor/datacenter.js`

**Interfaces:**
- Produces: constantes `PERIODS = 2`, `TUNNEL = ROWS * SPACING` (81.6) ; variable `camZ` ; convention **le monde est immuable après construction** (toutes les tâches suivantes en dépendent).
- Produces: toute décision aléatoire de contenu doit être semée par `(side, r)` uniquement, JAMAIS par la période, sinon le wrap devient visible.

- [ ] **Step 1 : Construire 2 périodes de baies identiques**

Dans `buildRacks()`, envelopper la boucle des rangées dans une boucle de périodes, en gardant le même `userData.r` :

```js
function buildRacks(){
  for(let p=0; p<PERIODS; p++){
    for(let side=-1; side<=1; side+=2){
      for(let r=0; r<ROWS; r++){
        const zc = Z0 - p*TUNNEL - r*SPACING - SPACING/2;
        const u = new THREE.Group(); u.position.set(0,0,zc); u.userData = { side, r };
        // ... reste inchangé (mesh caisson, face, poignée) MAIS la sélection de
        // texture de face doit être déterministe par (side, r) :
        const rndF = mulberry32(((r*73856093) ^ (side===1?19349663:97)) >>> 0);
        const faceMat = (rndF()<0.22) ? meshMats[Math.floor(rndF()*meshMats.length)] : serverMats[Math.floor(rndF()*serverMats.length)];
        // (supprimer pickF, qui dépendait de l'ordre d'appel et cassait la périodicité)
        units.push(u); worldGroup.add(u);
      }
    }
  }
}
```

Ajouter `const PERIODS = 2;` près des constantes. `buildLEDs()` est déjà semé par `(seed, r, side)` : les deux périodes auront automatiquement les mêmes LED. La poignée (`handle`) utilise aussi `rndF()` au lieu de `pickF()`.

- [ ] **Step 2 : Allonger les éléments statiques**

Dans `buildStatics()`, remplacer partout `ROWS*SPACING` par `PERIODS*TUNNEL` et recentrer : rails, plafond, Reflector et plan de sol passent à `length = PERIODS*TUNNEL + 24`, position z `Z0 - PERIODS*TUNNEL/2`.

- [ ] **Step 3 : Caméra mobile + wrap**

Dans `animate()`, supprimer la boucle `for(const u of units){ u.position.z += ... }` et la remplacer par :

```js
camZ -= config.camSpeed * dt;
if (camZ < Z_CAM - TUNNEL) camZ += TUNNEL;
```

avec `let camZ = Z_CAM;` déclaré près de `t0`, et la caméra :

```js
camera.position.set(Math.sin(time*0.12)*0.10, 1.5 + Math.sin(time*0.1)*0.04, camZ);
camera.lookAt(Math.sin(time*0.05)*0.15, 0.55, camZ - 12);
```

Supprimer la constante `NEAR_WRAP` devenue inutile.

- [ ] **Step 4 : Vérifier syntaxe + wrap invisible**

Run: `node --check assets/vendor/datacenter.js && echo OK`
Expected: `OK`

Au tuner : monter « Vitesse caméra » à 3.0 → la période complète dure 81.6/3 ≈ 27 s. Regarder 2 wraps complets : aucun saut, aucune baie qui change de contenu. Redescendre la vitesse. Vérifier que « ↻ Régénérer » change bien les LED des DEUX périodes de façon identique (fixer la vitesse à 3 et observer).

- [ ] **Step 5 : Commit**

```bash
git add assets/vendor/datacenter.js
git commit -m "refactor: monde statique 2 periodes, boucle infinie par wrap camera"
```

---

### Task 3 : Remplacer le Reflector par un monde miroir

Jalon perf principal : le second rendu de scène disparaît. On mesure avant/après.

**Files:**
- Modify: `assets/vendor/datacenter.js`

**Interfaces:**
- Produces: `mirrorGroup` (THREE.Group, `scale.y = -1`, ajouté à `scene`) ; convention : tout élément au-dessus du sol qui doit se refléter est cloné dans `mirrorGroup` juste après sa création dans le monde. `config.mirror` (0|1) pilote `mirrorGroup.visible`.
- Consumes: monde statique de la tâche 2 (le miroir n'est cloné qu'une fois, à la construction).

- [ ] **Step 1 : Supprimer le Reflector**

Dans `datacenter.js` : supprimer l'import `Reflector`, et dans `buildStatics()` supprimer la création du `mirror` (les 2 lignes `const mirror = new Reflector(...)` et `mirror.rotation... worldGroup.add(mirror)`).

- [ ] **Step 2 : Créer le monde miroir**

Après la création de `worldGroup` :

```js
const mirrorGroup = new THREE.Group();
mirrorGroup.scale.y = -1;                       // reflet sous le sol (y=0)
scene.add(mirrorGroup);
```

À la fin de `buildRacks()` et de `buildLEDs()` (après remplissage de `worldGroup` / des `units`), cloner :

```js
function buildMirror(){
  mirrorGroup.clear();
  for(const u of units){ mirrorGroup.add(u.clone()); }
}
```

Appeler `buildMirror()` après `buildRacks(); buildLEDs();` dans la séquence de démarrage, et à la fin de `buildLEDs()` quand elle est rappelée par le panneau (densité/palette/regen) : le plus simple est d'appeler `buildMirror()` à la fin de `buildLEDs()`.

Le scale négatif inverse le culling : passer les matériaux concernés en double face :

```js
rackMat.side = THREE.DoubleSide;
for(const m of meshMats) m.side = THREE.DoubleSide;
for(const m of serverMats) m.side = THREE.DoubleSide;
handleMat.side = THREE.DoubleSide;
```

- [ ] **Step 3 : Assombrir le reflet via le plan de sol**

Le plan `floor` existant (semi-transparent, `opacity: 0.34`) devient l'atténuateur du reflet : passer `opacity` à `0.62` et garder `color: 0x04060a`. Les LED miroir (additives) brilleront au travers : c'est l'effet recherché.

Ajouter la clé `mirror: 1` dans `DEFAULTS`, et dans `applyLive()` :

```js
mirrorGroup.visible = config.mirror !== 0;
```

- [ ] **Step 4 : Vérifier syntaxe + visuel + PERF**

Run: `node --check assets/vendor/datacenter.js && echo OK`
Expected: `OK`

Au tuner : le reflet au sol est toujours là (baies + LED inversées, estompées). Comparer ms/frame et draw calls à la baseline de la tâche 1 : **ms/frame doit baisser nettement** (le Reflector rendait la scène 2 fois). Relever aussi le % GPU dans le Gestionnaire de tâches Chrome (Fenêtre > Gestionnaire de tâches). Noter les valeurs dans le commit.

- [ ] **Step 5 : Commit**

```bash
git add assets/vendor/datacenter.js
git commit -m "perf: remplace le Reflector par un monde miroir (X.XX -> Y.YY ms/frame)"
```

---

### Task 4 : Instancing + atlas de façades + profondeur des baies

Les 272 groupes (2 périodes + miroir) deviennent ~4 InstancedMesh. Les faces reculent dans le caisson, des montants avant apparaissent. L'atlas remplace les 6 matériaux de face par un seul.

**Files:**
- Modify: `assets/vendor/dc-textures.js` (atlas)
- Modify: `assets/vendor/datacenter.js` (familles instanciées, matériau de face custom)

**Interfaces:**
- Produces (dc-textures): `makeFacadeAtlas(maxTexSize)` → `{ texture: THREE.CanvasTexture, cols: 4, rows: 2, tiles: 8 }`. Tuile k à l'offset UV `((k%4)/4, 1 - (Math.floor(k/4)+1)/2)`.
- Produces (datacenter): `slots` : tableau de `{ side, r, p, z, variant }` (variant 0..7 déterministe par `(side,r)`) ; familles `casesIM`, `facesIM`, `pillarsIM` (InstancedMesh, instances monde PUIS miroir : indices `[0..N-1]` monde, `[N..2N-1]` miroir) ; `faceMat` (ShaderMaterial avec uniforms `uAtlas`, `uTileScale`, `uBright`, `uFogColor`, `uFogDensity` et, posés ici pour la tâche 6 : `uRampSpacing`, `uRampZ0`, `uRampBright`).
- Consumes: `mirrorGroup` de la tâche 3 est SUPPRIMÉ pour les baies (le miroir passe dans les instances) ; il ne reste que pour les LED (points clonés).

- [ ] **Step 1 : L'atlas dans `dc-textures.js`**

Refactorer le dessin d'une façade en fonction de tuile, puis composer l'atlas. Les 8 tuiles réutilisent le dessin actuel (2 tuiles « mesh » via le contenu de `makeRackTexture`, 6 « serveur » via celui de `makeServerTexture`), chacune avec sa graine :

```js
// Dessine une façade dans la région (ox, oy, w, h) du contexte partagé.
// kind: 'server' | 'mesh'. Reprend le corps de makeServerTexture / makeRackTexture,
// en remplaçant les constantes W,H par w,h et les coordonnées par ox+..., oy+...
// (le plus sûr : ctx.save(); ctx.translate(ox, oy); ctx.scale(w/512, h/1024);
//  ...corps actuel inchangé en coordonnées 512x1024...; ctx.restore();)
function drawFacadeTile(x, ox, oy, w, h, seed, kind){
  x.save(); x.translate(ox, oy); x.scale(w/512, h/1024);
  if (kind === 'mesh') drawRackInto(x, seed);      // corps de makeRackTexture sans le CanvasTexture
  else                 drawServerInto(x, seed);    // corps de makeServerTexture sans le CanvasTexture
  x.restore();
}

export function makeFacadeAtlas(maxTexSize){
  const big = maxTexSize >= 4096;
  const tw = big ? 1024 : 512, th = big ? 2048 : 1024;   // tuile
  const c = document.createElement('canvas'); c.width = tw*4; c.height = th*2;
  const x = c.getContext('2d');
  const KINDS = ['mesh','mesh','server','server','server','server','server','server'];
  for(let k=0;k<8;k++){
    drawFacadeTile(x, (k%4)*tw, Math.floor(k/4)*th, tw, th, 3000 + k*277, KINDS[k]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return { texture: t, cols: 4, rows: 2, tiles: 8 };
}
```

Concrètement : extraire le corps de `makeRackTexture` en `drawRackInto(x, seed)` et celui de `makeServerTexture` en `drawServerInto(x, seed)` (mêmes dessins, sans création de canvas ni de texture), et faire des deux `make*Texture` historiques de simples wrappers (ils disparaîtront à la tâche suivante). `ctx.scale` gère le changement de résolution.

- [ ] **Step 2 : Les slots et les familles instanciées dans `datacenter.js`**

Remplacer `buildRacks()` + `buildMirror()` (pour les baies) par :

```js
const FACE_RECESS = 0.10;          // renfoncement de la façade
let slots = [], casesIM, facesIM, pillarsIM;

function buildSlots(){
  slots = [];
  for(let p=0; p<PERIODS; p++)
    for(let side=-1; side<=1; side+=2)
      for(let r=0; r<ROWS; r++){
        const rnd = mulberry32(((r*73856093) ^ (side===1?19349663:97)) >>> 0);
        slots.push({ side, r, p, z: Z0 - p*TUNNEL - r*SPACING - SPACING/2,
                     variant: Math.floor(rnd()*8) });
      }
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(),
      _q = new THREE.Quaternion(), _qF = new THREE.Quaternion(),
      _s1 = new THREE.Vector3(1,1,1), _sM = new THREE.Vector3(1,-1,1);

function setInst(im, i, x, y, z, quat, mirrored){
  _p.set(x, mirrored ? -y : y, z);
  _m.compose(_p, quat || _q.identity(), mirrored ? _sM : _s1);
  im.setMatrixAt(i, _m);
}

function buildRacks(){
  buildSlots();
  const N = slots.length;                                  // 136
  casesIM  = new THREE.InstancedMesh(rackGeo, rackMat, N*2);
  facesIM  = new THREE.InstancedMesh(faceGeo, faceMat, N*2);
  const pillarGeo = new THREE.BoxGeometry(0.07, RACK_H, 0.13);
  pillarsIM = new THREE.InstancedMesh(pillarGeo, pillarMat, N*4);   // 2 montants par baie
  const tiles = new Float32Array(N*2*2);                   // offset UV par instance de face
  slots.forEach((s, i) => {
    for(const mir of [0,1]){
      const j = i + mir*N;
      setInst(casesIM, j, s.side*RACK_X, RACK_H/2+0.05, s.z, null, mir);
      _qF.setFromAxisAngle(new THREE.Vector3(0,1,0), -s.side*Math.PI/2);
      // Face contre le caisson (comme avant) ; montants EN SAILLIE de FACE_RECESS vers
      // l'allée : vue de biais, la face paraît renfoncée derrière les montants.
      // (Ne PAS mettre la face à FACE_X + FACE_RECESS : elle serait DANS le caisson opaque.)
      setInst(facesIM, j, s.side*(FACE_X - 0.02), RACK_H/2+0.05, s.z, _qF, mir);
      tiles[j*2]   = (s.variant%4)/4;
      tiles[j*2+1] = 1 - (Math.floor(s.variant/4)+1)/2;
      setInst(pillarsIM, j*2,   s.side*(FACE_X - FACE_RECESS), RACK_H/2+0.05, s.z - RACK_Z*0.44, null, mir);
      setInst(pillarsIM, j*2+1, s.side*(FACE_X - FACE_RECESS), RACK_H/2+0.05, s.z + RACK_Z*0.44, null, mir);
    }
  });
  facesIM.geometry = faceGeo.clone();
  facesIM.geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 2));
  for(const im of [casesIM, facesIM, pillarsIM]){
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; worldGroup.add(im);
  }
}
```

ATTENTION Three.js : `aTile` est un attribut PAR INSTANCE sur la géométrie des faces ; `InstancedBufferAttribute` sur une géométrie standard fonctionne avec `InstancedMesh` (même mécanique que `instanceMatrix`). `pillarMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide });`. Supprimer `handleGeo`/`handleMat` et la sélection `meshMats`/`serverMats` par unité ; supprimer les 6 matériaux `meshMats`/`serverMats` et leurs textures (l'atlas les remplace). `rackMat` garde `side: THREE.DoubleSide` (miroir).

- [ ] **Step 3 : Le matériau de façade (ShaderMaterial + atlas)**

```js
const atlas = makeFacadeAtlas(renderer.capabilities.maxTextureSize);
const faceMat = new THREE.ShaderMaterial({
  uniforms: {
    uAtlas: { value: atlas.texture },
    uTileScale: { value: new THREE.Vector2(1/atlas.cols, 1/atlas.rows) },
    uBright: { value: 1.0 },
    uFogColor: { value: new THREE.Color(config.bg) },
    uFogDensity: { value: config.fog },
    uRampSpacing: { value: SPACING*2 },   // utilisés à partir de la tâche 6
    uRampZ0: { value: 0 },
    uRampBright: { value: 0 },            // 0 = modulation neutre pour l'instant
  },
  vertexShader: `
    #ifdef USE_INSTANCING
      attribute mat4 instanceMatrix;
    #endif
    attribute vec2 aTile;
    varying vec2 vUv; varying vec2 vTile; varying float vWZ; varying float vDist;
    void main(){
      vUv = uv; vTile = aTile;
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWZ = wp.z;
      vec4 mv = viewMatrix * wp;
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D uAtlas; uniform vec2 uTileScale;
    uniform float uBright, uFogDensity, uRampSpacing, uRampZ0, uRampBright;
    uniform vec3 uFogColor;
    varying vec2 vUv; varying vec2 vTile; varying float vWZ; varying float vDist;
    void main(){
      vec3 tex = texture2D(uAtlas, vUv * uTileScale + vTile).rgb;
      float d = (vWZ - uRampZ0) / uRampSpacing;
      float pool = pow(0.5 + 0.5*cos(6.28318*d), 1.6);
      float light = mix(1.0, 0.55 + 0.9*pool, clamp(uRampBright, 0.0, 2.0));
      vec3 col = tex * uBright * light;
      float f = 1.0 - exp(-uFogDensity*uFogDensity*vDist*vDist);   // même formule que FogExp2
      gl_FragColor = vec4(mix(col, uFogColor, clamp(f,0.0,1.0)), 1.0);
    }`,
  side: THREE.DoubleSide,
});
```

Trois.js définit `USE_INSTANCING` automatiquement quand le matériau est rendu par un `InstancedMesh` ; la déclaration doit être manuelle dans un ShaderMaterial (bloc `#ifdef` ci-dessus). Dans `applyLive()`, mettre à jour `faceMat.uniforms.uFogColor/uFogDensity`. Import à compléter : `import { mulberry32, makeFacadeAtlas } from './dc-textures.js';`

- [ ] **Step 4 : Adapter LED et miroir**

`buildLEDs()` : les LED restent des `THREE.Points` par... NON : les regrouper en UN SEUL Points global. Remplacer la boucle `for(const u of units)` par une boucle sur `slots` qui pousse tout dans des tableaux globaux (`pos/col/pha/rate/base`), avec `x = s.side*(FACE_X - 0.032)` (12 mm devant la face, qui est à FACE_X - 0.02) et `yy`/`zz` décalés de `s.z`. Semer par `(seed, s.r, s.side)` comme aujourd'hui (les 2 périodes restent identiques). À la fin, créer aussi les copies miroir : pour chaque LED, pousser `(x, -y, z)` avec `base*0.4`. Un seul `THREE.Points(g, ledMat)` ajouté à `scene` (pas à `worldGroup`), `frustumCulled=false`, référence gardée dans `ledPoints` pour le dispose/rebuild.

`mirrorGroup` et `buildMirror()` disparaissent entièrement (le miroir est maintenant dans les instances et les LED dupliquées). `config.mirror` pilotera à la place la visibilité des instances miroir : le plus simple est `im.count = config.mirror ? N*2 : N` pour les 3 familles (les instances miroir sont en seconde moitié) et la reconstruction des LED. Câbler ça dans `applyLive()` :

```js
const N = slots.length;
for(const im of [casesIM, facesIM, pillarsIM]) if(im) im.count = config.mirror !== 0 ? (im === pillarsIM ? N*4 : N*2) : (im === pillarsIM ? N*2 : N);
```

ATTENTION à l'ordre de remplissage pour que ce truncation-toggle marche : monde d'abord (indices 0..N-1), miroir ensuite (N..2N-1) ; pour `pillarsIM` : monde 0..2N-1, miroir 2N..4N-1. Ajuster `buildRacks()` en conséquence (`setInst(pillarsIM, i*2 + mir*N*2, ...)`).

- [ ] **Step 5 : Vérifier**

Run: `node --check assets/vendor/datacenter.js && node --check assets/vendor/dc-textures.js && echo OK`
Expected: `OK`

Au tuner : allée visuellement équivalente (les façades sont les mêmes dessins, désormais 8 variantes), faces légèrement en retrait avec montants visibles sur les bords d'écran, reflet toujours là. **Draw calls affichés : doivent chuter à ~10-15** (contre des centaines). ms/frame relevé. Contrôler l'absence de saut au wrap (vitesse 3). Toggle mirror non exposé au panneau pour l'instant : vérifier via la console DevTools `DC.config.mirror = 0; DC.applyLive()`.

- [ ] **Step 6 : Commit**

```bash
git add assets/vendor/datacenter.js assets/vendor/dc-textures.js
git commit -m "perf: baies instanciees + atlas de facades, faces renfoncees et montants (N draw calls)"
```

---

### Task 5 : Façades enrichies (le gros du réalisme de près)

Uniquement `dc-textures.js` : grilles hexagonales, câbles patch, étiquettes, occlusion ambiante. Résolution doublée déjà en place (tuiles 1024x2048 si le GPU le permet).

**Files:**
- Modify: `assets/vendor/dc-textures.js`

**Interfaces:**
- Consumes: `makeFacadeAtlas` (tâche 4) ; les nouvelles fonctions sont internes au module.
- Produces: mêmes exports (l'atlas dessine simplement mieux) ; nouvelle répartition des 8 tuiles : 0-1 portes grillagées hex, 2-4 piles de serveurs, 5 switch + panneau de brassage câblé, 6 baies de stockage denses, 7 PDU + serveurs.

- [ ] **Step 1 : Primitives nouvelles**

Ajouter dans `dc-textures.js` (coordonnées logiques 512x1024, le `ctx.scale` de la tuile fait le reste) :

```js
// Porte grillagée : perforations hexagonales en quinconce + lueurs de LED derrière.
function drawHexDoor(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle = '#0a0c10'; x.fillRect(0, 0, 512, 1024);
  // lueurs diffuses derrière la grille (LED des serveurs devinées au travers)
  for(let i=0;i<26;i++){
    const gx = 60+rnd()*392, gy = 40+rnd()*944;
    const cols = ['57,255,154','55,192,255','201,160,255','255,207,77'];
    const cc = cols[Math.floor(rnd()*cols.length)];
    const g = x.createRadialGradient(gx,gy,0,gx,gy,14+rnd()*22);
    g.addColorStop(0, `rgba(${cc},${0.10+rnd()*0.12})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(gx-36,gy-36,72,72);
  }
  // grille : hexagones percés
  x.fillStyle = 'rgba(16,19,26,0.92)';
  const rHex = 5.2, dx = rHex*1.9, dy = rHex*1.65;
  for(let row=0, yy=14; yy<1010; row++, yy+=dy){
    for(let xx=14+(row%2)*dx/2; xx<500; xx+=dx){
      x.beginPath();
      for(let a=0;a<6;a++){ const t=Math.PI/6 + a*Math.PI/3;
        x[a?'lineTo':'moveTo'](xx+Math.cos(t)*rHex, yy+Math.sin(t)*rHex); }
      x.closePath();
      x.globalCompositeOperation='destination-out'; x.globalAlpha=0.85; x.fill();
      x.globalCompositeOperation='source-over'; x.globalAlpha=1;
      x.strokeStyle='rgba(120,130,150,0.10)'; x.lineWidth=0.8; x.stroke();
    }
  }
  // NB destination-out perce la couche courante : dessiner la porte sur un canvas
  // temporaire puis la plaquer, pour ne pas percer le fond de tuile :
  // implémenter via un canvas offscreen local (même taille), cf. note sous ce bloc.
  x.fillStyle='rgba(255,255,255,0.05)'; x.fillRect(0,0,512,3);
  x.fillStyle='rgba(0,0,0,0.75)'; x.fillRect(0,1021,512,3);
  drawScrew(x,14,14); drawScrew(x,498,14); drawScrew(x,14,1010); drawScrew(x,498,1010);
}
```

Note d'implémentation : le motif percé se dessine sur un canvas offscreen (512x1024) rempli de tôle sombre, percé en `destination-out`, puis `drawImage` par-dessus les lueurs. Écrire la fonction ainsi dès le départ.

```js
// Arcs de câbles patch entre deux points (panneau de brassage).
function drawPatchCables(x, rnd, y0, y1){
  const COLORS = ['#7c3aed','#8b5cf6','#39ff9a','#37c0ff','#ffcf4d','#e8e8ee'];
  const n = 8 + Math.floor(rnd()*10);
  for(let i=0;i<n;i++){
    const xa = 46+rnd()*180, xb = 280+rnd()*180;
    const ya = y0+rnd()*(y1-y0), yb = y0+rnd()*(y1-y0);
    const sag = 22+rnd()*46;
    x.strokeStyle = COLORS[Math.floor(rnd()*COLORS.length)];
    x.globalAlpha = 0.5+rnd()*0.4; x.lineWidth = 2.4;
    x.beginPath(); x.moveTo(xa,ya);
    x.bezierCurveTo(xa+18, ya+sag, xb-18, yb+sag, xb, yb); x.stroke();
    x.globalAlpha = 1;
  }
}

// Étiquette d'inventaire (petit rectangle + pseudo code-barres + texte).
function drawLabel(x, rnd, lx, ly){
  x.fillStyle='rgba(226,229,236,0.80)'; x.fillRect(lx,ly,44,14);
  x.fillStyle='#0a0c10';
  for(let i=0;i<16;i++){ if(rnd()<0.6) x.fillRect(lx+3+i*2.3, ly+2, rnd()<0.4?1.6:0.8, 6); }
  x.font='5px monospace'; x.fillStyle='#20242c';
  x.fillText('YK-'+String(100+Math.floor(rnd()*900)), lx+4, ly+12.5);
}

// Occlusion ambiante cuite : bords assombris + dégradé vertical léger.
function bakeAO(x){
  let g = x.createLinearGradient(0,0,0,1024);
  g.addColorStop(0,'rgba(0,0,0,0.34)'); g.addColorStop(0.18,'rgba(0,0,0,0.05)');
  g.addColorStop(0.72,'rgba(0,0,0,0.05)'); g.addColorStop(1,'rgba(0,0,0,0.45)');
  x.fillStyle=g; x.fillRect(0,0,512,1024);
  g = x.createLinearGradient(0,0,512,0);
  g.addColorStop(0,'rgba(0,0,0,0.30)'); g.addColorStop(0.12,'rgba(0,0,0,0)');
  g.addColorStop(0.88,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.30)');
  x.fillStyle=g; x.fillRect(0,0,512,1024);
}
```

- [ ] **Step 2 : Les 8 tuiles**

Réécrire la table des tuiles de `makeFacadeAtlas` :

```js
const TILES = [
  s => drawHexDoor(x, s), s => drawHexDoor(x, s+13),
  s => drawServerInto(x, s), s => drawServerInto(x, s+7), s => drawServerInto(x, s+29),
  s => drawSwitchPanel(x, s),        // nouveau : bandeaux switch + brassage + drawPatchCables
  s => drawStorageWall(x, s),        // nouveau : colonnes denses de tiroirs disques (réutilise le bloc "bays" de drawUnit, répété)
  s => drawPduColumn(x, s),          // nouveau : bandeau PDU vertical (prises + LED) + serveurs
];
```

Code des trois nouvelles tuiles (mêmes coordonnées logiques 512x1024) :

```js
function drawSwitchPanel(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle='#06080b'; x.fillRect(0,0,512,1024);
  // 2 switchs 1U en haut : rangée de ports + micro-LED d'activité
  for(let sw=0; sw<2; sw++){
    const y = 30 + sw*54;
    x.fillStyle='#10141a'; x.fillRect(30, y, 452, 40);
    x.strokeStyle='#2c333e'; x.strokeRect(30.5, y+0.5, 451, 39);
    for(let i=0;i<24;i++){
      const px2 = 44 + i*18;
      x.fillStyle='#04060a'; x.fillRect(px2, y+16, 13, 15);
      x.fillStyle = rnd()<0.7 ? '#39ff9a' : (rnd()<0.5 ? '#ffcf4d' : '#0e1218');
      x.globalAlpha = 0.45+rnd()*0.55; x.fillRect(px2+2, y+8, 4, 3); x.globalAlpha = 1;
    }
  }
  // panneau de brassage au centre : 2 rangées de ports + arcs de câbles
  for(let row=0; row<2; row++){
    const y = 300 + row*230;
    x.fillStyle='#0c0f14'; x.fillRect(30, y-24, 452, 44);
    for(let i=0;i<20;i++){ x.fillStyle='#030508'; x.fillRect(42+i*22, y-16, 15, 15);
      x.strokeStyle='#232a34'; x.strokeRect(42.5+i*22, y-15.5, 14, 14); }
  }
  drawPatchCables(x, rnd, 300, 560);
  // bas : serveurs classiques
  let y = 620; while(y < 1000){ const uH = 40+rnd()*60;
    drawUnit(x, 30, y, 452, Math.min(uH, 1000-y), rnd); y += uH+3; }
  drawLabel(x, rnd, 36, 12); drawLabel(x, rnd, 430, 990);
  bakeAO(x);
}

function drawStorageWall(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle='#06080b'; x.fillRect(0,0,512,1024);
  // colonnes denses de tiroirs disques du haut en bas
  for(let y=16; y<990; y+=34){
    let dx = 36;
    while(dx+30 < 476){
      const bg = x.createLinearGradient(dx,0,dx+28,0);
      bg.addColorStop(0,'#1c2129'); bg.addColorStop(1,'#0c0e13');
      x.fillStyle=bg; x.fillRect(dx, y, 28, 28);
      x.strokeStyle='#3a4250'; x.lineWidth=1; x.strokeRect(dx+0.5, y+0.5, 27, 27);
      x.fillStyle='#05070b'; x.fillRect(dx+3, y+4, 22, 5);
      x.fillStyle = rnd()<0.8 ? '#39ff9a' : (rnd()<0.5 ? '#ffcf4d' : '#ff5b5b');
      x.globalAlpha = 0.5+rnd()*0.5; x.fillRect(dx+21, y+21, 4, 3); x.globalAlpha = 1;
      dx += 31;
    }
  }
  drawLabel(x, rnd, 40, 8); bakeAO(x);
}

function drawPduColumn(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle='#06080b'; x.fillRect(0,0,512,1024);
  // serveurs sur la largeur restante
  let y = 10; while(y < 1010){ const uH = 40+rnd()*60;
    drawUnit(x, 30, y, 380, Math.min(uH, 1010-y), rnd); y += uH+3; }
  // bandeau PDU vertical à droite : prises + LED
  x.fillStyle='#0a0c11'; x.fillRect(420, 8, 62, 1008);
  x.strokeStyle='#262d38'; x.strokeRect(420.5, 8.5, 61, 1007);
  for(let i=0;i<18;i++){
    const py = 34 + i*54;
    x.fillStyle='#03050a'; x.fillRect(434, py, 34, 26);
    x.strokeStyle='#1f2630'; x.strokeRect(434.5, py+0.5, 33, 25);
    x.fillStyle = (i%3===0) ? '#ff5b5b' : '#39ff9a';
    x.globalAlpha = 0.6+rnd()*0.4; x.fillRect(452, py+32, 3, 3); x.globalAlpha = 1;
  }
  drawLabel(x, rnd, 430, 990); bakeAO(x);
}
```

Chaque tuile se termine par `bakeAO(x)`.

- [ ] **Step 3 : Vérifier**

Run: `node --check assets/vendor/dc-textures.js && echo OK`
Expected: `OK`

Au tuner : zoomer visuellement (baisser le brouillard à 0.005 temporairement) et inspecter les 8 variantes : portes grillagées avec lueurs au travers, câbles colorés, étiquettes lisibles à ~1 m, pas de moiré violent en mouvement (l'anisotropy 16 + mipmaps gèrent ; si moiré : réduire le contraste des hexagones à 0.06). Remettre le brouillard.

- [ ] **Step 4 : Commit**

```bash
git add assets/vendor/dc-textures.js
git commit -m "feat: facades enrichies (portes hex, cables patch, etiquettes, AO cuite)"
```

---

### Task 6 : Éclairage (rampes, sol, modulation, fond d'allée)

**Files:**
- Modify: `assets/vendor/datacenter.js` (rampes instanciées, sol texturé, uniforms)
- Modify: `assets/vendor/dc-textures.js` (texture du sol, texture de lueur)

**Interfaces:**
- Produces (dc-textures): `makeFloorTexture()` → CanvasTexture 512x1024 couvrant 14 m (X) x 4.8 m (Z) monde, RepeatWrapping ; `makeGlowTexture(size=128)` → dégradé radial blanc→transparent (réutilisé tâche 7).
- Produces (datacenter): `RAMP_SPACING = SPACING*2` (4.8), `RAMP_Z0 = Z0 - 1.2` (z de la première rampe, la phase de TOUT l'éclairage) ; `rampsIM` ; clé config `ramp` (défaut 1.0).
- Consumes: uniforms `uRampSpacing/uRampZ0/uRampBright` de `faceMat` (tâche 4).

- [ ] **Step 1 : Texture du sol (dalles + pools de lumière)**

Dans `dc-textures.js` :

```js
export function makeFloorTexture(){
  const W=512, H=1024;   // 14 m x 4.8 m monde -> 1 travée de rampe
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  x.fillStyle='#05070b'; x.fillRect(0,0,W,H);
  // dalles 0.6 m : pas de 512/14*0.6 ≈ 22 px en X, 1024/4.8*0.6 = 128 px en Z
  const px=W/14*0.6, pz=H/4.8*0.6;
  x.strokeStyle='rgba(150,170,205,0.07)'; x.lineWidth=1;
  for(let gx=0; gx<=W; gx+=px){ x.beginPath(); x.moveTo(gx,0); x.lineTo(gx,H); x.stroke(); }
  for(let gz=0; gz<=H; gz+=pz){ x.beginPath(); x.moveTo(0,gz); x.lineTo(W,gz); x.stroke(); }
  // perforations d'aération sur les dalles côté baies
  for(let gz=pz/2; gz<H; gz+=pz) for(let gx=px/2; gx<W; gx+=px){
    const lane = gx < W*0.30 || gx > W*0.70;
    if(!lane) continue;
    for(let i=0;i<9;i++){ x.fillStyle='rgba(0,0,0,0.5)';
      x.beginPath(); x.arc(gx-6+(i%3)*6, gz-6+Math.floor(i/3)*6, 1.1, 0, 6.2832); x.fill(); }
  }
  // pool de lumière de la rampe : ellipse centrée en Z=H/2 (sous la rampe), centre d'allée
  let g = x.createRadialGradient(W/2,H/2,10, W/2,H/2,240);
  g.addColorStop(0,'rgba(205,200,255,0.16)'); g.addColorStop(0.45,'rgba(190,180,255,0.07)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  x.save(); x.translate(W/2,H/2); x.scale(0.55,1); x.translate(-W/2,-H/2);
  x.fillStyle=g; x.fillRect(0,0,W,H); x.restore();
  // usure : traces de roulettes au centre de l'allée
  x.fillStyle='rgba(255,255,255,0.016)';
  x.fillRect(W*0.44,0,7,H); x.fillRect(W*0.53,0,7,H);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=16;
  return t;
}

export function makeGlowTexture(size=128){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.35)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
```

- [ ] **Step 2 : Sol texturé + rampes + fond d'allée dans `datacenter.js`**

Dans `buildStatics()` : le plan `floor` (l'atténuateur du miroir) reçoit la texture :

```js
const floorTex = makeFloorTexture();
floorTex.repeat.set(1, (PERIODS*TUNNEL + 24)/4.8);
// phase : le pool (centre de tuile) doit tomber sous RAMP_Z0 ; le plan est centré en
// zC = Z0 - PERIODS*TUNNEL/2 ; offset = ((zC + L/2) - (RAMP_Z0 + 2.4)) / 4.8 modulo 1
const L = PERIODS*TUNNEL + 24, zC = Z0 - PERIODS*TUNNEL/2;
floorTex.offset.y = (((zC + L/2) - (RAMP_Z0 + 2.4)) / 4.8) % 1;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, L),
  new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0.88, color: 0xffffff }));
floor.rotation.x = -Math.PI/2; floor.position.set(0, 0.002, zC); worldGroup.add(floor);
```

(Si l'alignement pool/rampe est décalé au tuner, ajuster le signe de l'offset : c'est le seul point à régler visuellement.) L'ancienne `opacity 0.62` de la tâche 3 est remplacée par ce plan-ci (garder ~0.88 : le miroir transparaît dans les 12 % restants et à travers les zones sombres de la texture).

Rampes (et leur reflet). `RAMP_SPACING` et `RAMP_Z0` se déclarent près des constantes du tunnel (`ROWS`, `SPACING`...) car le bloc sol ci-dessus les référence déjà :

```js
const RAMP_SPACING = SPACING*2, RAMP_Z0 = Z0 - 1.2;   // à placer avec les constantes du tunnel
const rampGeo = new THREE.BoxGeometry(0.55, 0.06, 1.5);
const rampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const NRAMP = Math.round(PERIODS*TUNNEL/RAMP_SPACING);   // 34
const rampsIM = new THREE.InstancedMesh(rampGeo, rampMat, NRAMP*2);
for(let k=0;k<NRAMP;k++){
  const z = RAMP_Z0 - k*RAMP_SPACING;
  setInst(rampsIM, k, 0, RACK_H + 1.02, z, null, 0);
  setInst(rampsIM, k+NRAMP, 0, RACK_H + 1.02, z, null, 1);
}
rampsIM.instanceMatrix.needsUpdate = true; rampsIM.frustumCulled = false;
worldGroup.add(rampsIM);
```

Fond d'allée : aux deux extrémités de période, un plan de lueur discret :

```js
const glowMat = new THREE.MeshBasicMaterial({ map: makeGlowTexture(), transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, color: 0x8f7ad9, opacity: 0.5 });
for(const zEnd of [Z0 - TUNNEL - 2, Z0 - 2*TUNNEL - 2]){
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), glowMat);
  glow.position.set(0, 2.2, zEnd); worldGroup.add(glow);
}
```

- [ ] **Step 3 : Brancher la clé `ramp` et la modulation**

`DEFAULTS` : ajouter `ramp: 1.0`. Dans `applyLive()` :

```js
rampMat.color.setScalar(0.75 + 1.5*config.ramp);           // blanc chaud -> le bloom fait le halo
faceMat.uniforms.uRampBright.value = config.ramp;
faceMat.uniforms.uRampZ0.value = RAMP_Z0;
```

Dans `dc-panel.js`, ajouter au tableau `SLIDERS`, après le groupe LED :

```js
{ group:'Éclairage' },
{ key:'ramp', label:'Rampes plafond', min:0, max:2, step:0.05, fmt:v=>v.toFixed(2) },
```

- [ ] **Step 4 : Vérifier**

Run: `node --check assets/vendor/datacenter.js && node --check assets/vendor/dc-textures.js && node --check assets/vendor/dc-panel.js && echo OK`
Expected: `OK`

Au tuner : rampes lumineuses régulières au plafond avec halo bloom, reflet des rampes au sol, pools de lumière alignés sous les rampes (sinon corriger le signe de `floorTex.offset.y`), façades qui s'éclaircissent en passant sous une rampe (slider « Rampes plafond » à 0 → tout redevient uniforme : bon test), dalles au sol visibles en mouvement, lueur discrète en bout d'allée. Slider vitesse 3 → vérifier l'absence de saut au wrap (rampes comprises). ms/frame : hausse attendue ≤ 0.3 ms.

- [ ] **Step 5 : Commit**

```bash
git add assets/vendor/datacenter.js assets/vendor/dc-textures.js assets/vendor/dc-panel.js
git commit -m "feat: eclairage cuit (rampes plafond, pools au sol, modulation des facades, fond d'allee)"
```

---

### Task 7 : Atmosphère (faux volumétrique + poussière)

**Files:**
- Modify: `assets/vendor/datacenter.js`
- Modify: `assets/vendor/dc-panel.js` (2 sliders)

**Interfaces:**
- Consumes: `makeGlowTexture` (tâche 6), `RAMP_SPACING/RAMP_Z0/NRAMP` (tâche 6), `camZ` (tâche 2).
- Produces: clés config `shaft` (défaut 0.5) et `dust` (défaut 0.5) ; uniforms `uCamZ` (poussière).

- [ ] **Step 1 : Cônes de lumière sous les rampes**

```js
const shaftGeo = new THREE.ConeGeometry(1.5, 3.4, 14, 1, true);   // ouvert, pointe en haut
const shaftTex = makeGlowTexture(64);
shaftTex.wrapS = THREE.ClampToEdgeWrapping;
const shaftMat = new THREE.MeshBasicMaterial({
  map: shaftTex, transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, side: THREE.DoubleSide, color: 0xbcb3e8, opacity: 0.10 });
const shaftsIM = new THREE.InstancedMesh(shaftGeo, shaftMat, NRAMP);   // pas de miroir
for(let k=0;k<NRAMP;k++) setInst(shaftsIM, k, 0, RACK_H + 1.02 - 1.7, RAMP_Z0 - k*RAMP_SPACING, null, 0);
shaftsIM.instanceMatrix.needsUpdate = true; shaftsIM.frustumCulled = false;
worldGroup.add(shaftsIM);
```

Le dégradé radial plaqué sur le cône donne un fondu doux vers le bas et sur les bords (UV du cône : v le long de la hauteur). Si le rendu manque de douceur au tuner, remplacer `map` par une texture dégradé vertical dédiée (8x128, blanc en haut → transparent en bas) : 5 lignes dans dc-textures sur le modèle de `makeGlowTexture`.

- [ ] **Step 2 : Poussière défilante (shader autonome, zéro CPU)**

```js
const DUST_N = 300, DUST_LEN = 30.0;
const dustGeo = new THREE.BufferGeometry();
{
  const p = new Float32Array(DUST_N*3), sd = new Float32Array(DUST_N);
  const rndD = mulberry32(4242);
  for(let i=0;i<DUST_N;i++){
    // concentrées vers le centre d'allée et la hauteur des shafts
    p[i*3]   = (rndD()*2-1) * (0.6 + rndD()*1.4);
    p[i*3+1] = 0.4 + rndD()*4.2;
    p[i*3+2] = rndD()*DUST_LEN;                    // z de départ, replié par le shader
    sd[i] = rndD();
  }
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(p,3));
  dustGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd,1));
}
const dustMat = new THREE.ShaderMaterial({
  uniforms: { uTime:{value:0}, uCamZ:{value:Z_CAM}, uDust:{value:config.dust},
              uHeight:{value:600}, uRampSpacing:{value:RAMP_SPACING}, uRampZ0:{value:RAMP_Z0} },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aSeed;
    uniform float uTime, uCamZ, uDust, uHeight, uRampSpacing, uRampZ0;
    varying float vA;
    void main(){
      vec3 p = position;
      float z = mod(p.z + uTime*(0.18 + aSeed*0.15), 30.0);
      p.z = uCamZ + 1.0 - z;
      p.x += sin(uTime*0.30 + aSeed*40.0)*0.22;
      p.y += sin(uTime*0.21 + aSeed*70.0)*0.15;
      // plus visible sous les rampes (dans les shafts)
      float d = (p.z - uRampZ0)/uRampSpacing;
      float inShaft = 0.35 + 0.65*pow(0.5+0.5*cos(6.28318*d), 2.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = min(5.0, 0.02*uHeight/max(-mv.z, 0.1));
      float tw = 0.6 + 0.4*sin(uTime*(0.8+aSeed*2.0) + aSeed*90.0);
      vA = uDust * inShaft * tw * smoothstep(0.0, 3.0, -mv.z) * smoothstep(28.0, 14.0, -mv.z);
    }`,
  fragmentShader: `
    varying float vA;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float a = smoothstep(0.5, 0.1, length(uv)) * vA * 0.22;
      gl_FragColor = vec4(vec3(0.82, 0.79, 0.95), a);
    }`
});
const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
```

Dans `animate()` : `dustMat.uniforms.uTime.value = time; dustMat.uniforms.uCamZ.value = camZ;`. (La constante GLSL `30.0` doit rester égale à `DUST_LEN`.)

- [ ] **Step 3 : Clés config + sliders**

`DEFAULTS` : `shaft: 0.5, dust: 0.5`. `applyLive()` :

```js
shaftMat.opacity = 0.20 * config.shaft;
dustMat.uniforms.uDust.value = config.dust;
```

`dc-panel.js`, dans le groupe Éclairage :

```js
{ key:'shaft', label:'Faisceaux', min:0, max:1, step:0.05, fmt:v=>v.toFixed(2) },
{ key:'dust', label:'Poussière', min:0, max:1, step:0.05, fmt:v=>v.toFixed(2) },
```

- [ ] **Step 4 : Vérifier**

Run: `node --check assets/vendor/datacenter.js && node --check assets/vendor/dc-panel.js && echo OK`
Expected: `OK`

Au tuner : cônes de lumière doux sous les rampes (slider Faisceaux 0 → disparaissent), poussière qui dérive lentement vers la caméra, scintille, plus dense dans les faisceaux, invisible de très près (fondu < 3 m). Wrap toujours invisible (la poussière est relative caméra : insensible au wrap car `uCamZ` saute avec elle ; vérifier à vitesse 3 qu'elle ne « claque » pas au wrap : si oui, remplacer `uCamZ` dans le shader par `mod(uCamZ, TUNNEL)` calculé côté JS : `dustMat.uniforms.uCamZ.value = camZ;` reste correct car le repli du shader est en espace local, vérifier simplement). ms/frame : hausse ≤ 0.2 ms.

- [ ] **Step 5 : Commit**

```bash
git add assets/vendor/datacenter.js assets/vendor/dc-panel.js
git commit -m "feat: atmosphere (faisceaux volumetriques fake sous les rampes, poussiere flottante)"
```

---

### Task 8 : Vie (écrans de logs, LED trafic, chemins de câbles)

**Files:**
- Modify: `assets/vendor/dc-textures.js` (texture logs, texture chemin de câbles)
- Modify: `assets/vendor/datacenter.js` (écrans instanciés, shader LED, chemins de câbles)
- Modify: `assets/vendor/dc-panel.js` (2 sliders)

**Interfaces:**
- Produces (dc-textures): `makeLogTexture()` → CanvasTexture 256x512 RepeatWrapping en Y (pseudo-terminal) ; `makeTrayTexture()` → CanvasTexture 64x256 (grille métallique, RepeatWrapping).
- Produces (datacenter): clés config `screens` (défaut 1.0, vitesse de défilement) et `traffic` (défaut 0.6) ; attribut LED `aTr` (1.0 = LED d'activité réseau).
- Consumes: `slots` (tâche 4) : un écran sur les slots où `mulberry32((s.r*2654435761 ^ (s.side===1?7:11))>>>0)() < 0.14` (déterministe par (side, r) → périodicité conservée).

- [ ] **Step 1 : Texture de logs dans `dc-textures.js`**

```js
export function makeLogTexture(){
  const W=256, H=512;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d'); const rnd=mulberry32(90210);
  x.fillStyle='#04070a'; x.fillRect(0,0,W,H);
  x.font='7px monospace';
  const COLS=['#39ff9a','#c9a0ff','#d8dbe2','#ffcf4d','#37c0ff'];
  const WORDS=['[ ok ]','[warn]','probe','sync','eth0','bgp','ipmi','fan2','42.1C','psu-a','raid','scrub','vlan','tls'];
  for(let y=10; y<H-4; y+=10){
    let lx=6;
    const n=2+Math.floor(rnd()*4);
    for(let i=0;i<n;i++){
      x.fillStyle=COLS[Math.floor(rnd()*COLS.length)];
      x.globalAlpha=0.5+rnd()*0.5;
      const w = rnd()<0.5 ? WORDS[Math.floor(rnd()*WORDS.length)]
                          : (Math.floor(rnd()*0xffff)).toString(16).padStart(4,'0');
      x.fillText(w, lx, y); lx += 8 + w.length*4.6 + rnd()*14;
      if(lx>W-30) break;
    }
    if(rnd()<0.12){ x.fillStyle='#39ff9a'; x.globalAlpha=0.7;
      x.fillRect(6, y+2, 40+rnd()*160, 2.5); }
    x.globalAlpha=1;
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.ClampToEdgeWrapping; t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

export function makeTrayTexture(){
  const c=document.createElement('canvas'); c.width=64; c.height=256;
  const x=c.getContext('2d');
  x.fillStyle='#0b0d11'; x.fillRect(0,0,64,256);
  x.strokeStyle='rgba(140,150,175,0.16)'; x.lineWidth=2;
  for(let z=0; z<256; z+=16){ x.beginPath(); x.moveTo(4,z); x.lineTo(60,z); x.stroke(); }
  x.strokeStyle='rgba(140,150,175,0.22)';
  x.beginPath(); x.moveTo(4,0); x.lineTo(4,256); x.stroke();
  x.beginPath(); x.moveTo(60,0); x.lineTo(60,256); x.stroke();
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
  return t;
}
```

- [ ] **Step 2 : Écrans instanciés dans `datacenter.js`**

```js
const screenGeo = new THREE.PlaneGeometry(0.62, 0.44);
const screenMat = new THREE.ShaderMaterial({
  uniforms: { uMap:{value:makeLogTexture()}, uTime:{value:0}, uSpeed:{value:config.screens} },
  side: THREE.DoubleSide,
  vertexShader: `
    #ifdef USE_INSTANCING
      attribute mat4 instanceMatrix;
    #endif
    attribute float aPhase;
    varying vec2 vUv; varying float vPh;
    void main(){
      vUv = uv; vPh = aPhase;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D uMap; uniform float uTime, uSpeed;
    varying vec2 vUv; varying float vPh;
    void main(){
      vec2 uv = vec2(vUv.x, fract(vUv.y*0.5 + uTime*0.02*uSpeed + vPh));
      vec3 col = texture2D(uMap, uv).rgb * 1.5;
      float scan = 0.92 + 0.08*sin(vUv.y*240.0);
      float edge = smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x)
                 * smoothstep(0.0,0.09,vUv.y)*smoothstep(1.0,0.91,vUv.y);
      gl_FragColor = vec4(col*scan*edge + vec3(0.01,0.02,0.015), 1.0);
    }`
});
function buildScreens(){
  const scr = [];
  for(const s of slots){
    if (mulberry32((s.r*2654435761 ^ (s.side===1?7:11))>>>0)() < 0.14) scr.push(s);
  }
  const screensIM = new THREE.InstancedMesh(screenGeo, screenMat, scr.length);
  const ph = new Float32Array(scr.length);
  scr.forEach((s, i) => {
    const rnd = mulberry32((s.r*97 + 5)>>>0);
    _qF.setFromAxisAngle(new THREE.Vector3(0,1,0), -s.side*Math.PI/2);
    setInst(screensIM, i, s.side*(FACE_X - 0.035), 1.4 + rnd()*1.8, s.z + (rnd()-0.5)*0.8, _qF, 0);
    ph[i] = rnd();
  });
  screensIM.geometry = screenGeo.clone();
  screensIM.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  screensIM.instanceMatrix.needsUpdate = true; screensIM.frustumCulled = false;
  worldGroup.add(screensIM);
}
```

Appeler `buildScreens()` dans la séquence de démarrage. Dans `animate()` : `screenMat.uniforms.uTime.value = time;`. Pas de miroir (à peine visibles dans le reflet, on économise).

- [ ] **Step 3 : LED « trafic réseau »**

Dans `buildLEDs()` : l'accent vert/bleu (`accent<0.06` et le cas `#39ff9a`/`#37c0ff` des lignes) marque une LED d'activité : pousser `1` dans un nouveau tableau `tr`, sinon `0`. Ajouter l'attribut : `g.setAttribute('aTr', new THREE.Float32BufferAttribute(tr,1));`. ATTENTION : la boucle de duplication miroir (tâche 4) duplique TOUS les attributs, `aTr` compris, sinon les tableaux seront désalignés.

Dans `ledMat` : uniform `uTraffic:{value:config.traffic}` et vertexShader :

```glsl
attribute float aTr;
// ... après le calcul de `blink` existant :
float slot2 = floor(uTime*(1.5 + aRate*2.0) + aPhase*97.0);
float burst = step(0.86, fract(sin(slot2*12.9898 + aPhase*78.233)*43758.5453));
float b = aBase * mix(0.9, blink, step(0.12, aRate));
b = mix(b, aBase*(0.25 + 1.05*burst), aTr*uTraffic);
```

(remplace la ligne `float b = ...` existante ; les LED d'activité passent en rafales pseudo-aléatoires façon switch, les autres gardent leur sinus). `applyLive()` : `ledMat.uniforms.uTraffic.value = config.traffic;`.

- [ ] **Step 4 : Chemins de câbles**

Dans `buildStatics()`, remplacer les 2 rails actuels par :

```js
const trayTex = makeTrayTexture();
trayTex.repeat.set(1, (PERIODS*TUNNEL+24)/2);
const trayMat = new THREE.MeshStandardMaterial({ map: trayTex, color: 0xffffff,
  roughness: 0.7, metalness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
const cableMat = new THREE.MeshStandardMaterial({ color: 0x191324, roughness: 0.8, metalness: 0.1 });
const cableColors = [0x241a38, 0x101018, 0x1e1030];
for(let side=-1; side<=1; side+=2){
  const tray = new THREE.Mesh(new THREE.PlaneGeometry(0.55, PERIODS*TUNNEL+24), trayMat);
  tray.rotation.x = Math.PI/2; tray.position.set(side*1.45, RACK_H+0.5, zC);
  worldGroup.add(tray);
  for(let ci=0; ci<3; ci++){
    const cbl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, PERIODS*TUNNEL+24, 6),
      new THREE.MeshStandardMaterial({ color: cableColors[ci], roughness: 0.85 }));
    cbl.rotation.x = Math.PI/2;
    cbl.position.set(side*1.45 - 0.14 + ci*0.14, RACK_H+0.56, zC);
    worldGroup.add(cbl);
  }
}
```

(`zC` est déjà défini à la tâche 6 ; supprimer l'ancien code `rail`).

- [ ] **Step 5 : Clés + sliders**

`DEFAULTS` : `screens: 1.0, traffic: 0.6`. `applyLive()` : `screenMat.uniforms.uSpeed.value = config.screens;`. `dc-panel.js`, groupe LED :

```js
{ key:'traffic', label:'Trafic réseau', min:0, max:1, step:0.05, fmt:v=>v.toFixed(2) },
```

et groupe Éclairage : `{ key:'screens', label:'Écrans (vitesse)', min:0, max:3, step:0.1, fmt:v=>v.toFixed(1) },`.

- [ ] **Step 6 : Vérifier**

Run: `node --check assets/vendor/datacenter.js && node --check assets/vendor/dc-textures.js && node --check assets/vendor/dc-panel.js && echo OK`
Expected: `OK`

Au tuner : petits écrans lumineux clairsemés avec logs qui défilent (slider vitesse), certaines LED crépitent en rafales (slider Trafic à 0 → retour au sinus pur), chemins de câbles + câbles visibles au plafond en levant les yeux (ils passent en haut de l'écran). Wrap invisible (écrans semés par (side, r)). ms/frame stable.

- [ ] **Step 7 : Commit**

```bash
git add assets/vendor/datacenter.js assets/vendor/dc-textures.js assets/vendor/dc-panel.js
git commit -m "feat: vie du datacenter (ecrans de logs, LED trafic reseau, chemins de cables)"
```

---

### Task 9 : Poster statique, démarrage différé, reduced-motion

**Files:**
- Modify: `assets/vendor/datacenter.js` (boot + capture)
- Modify: `assets/vendor/dc-panel.js` (bouton export)
- Modify: `src/templates/layout.html` (div poster)
- Modify: `src/input.css` (`.scene-poster`, transition du canvas)
- Modify: `build/generate.mjs` (copie des posters, placeholder)

**Interfaces:**
- Produces: fichiers `assets/poster-link.webp` et `assets/poster-pro.webp` (générés manuellement via le tuner, versionnés) copiés en `apps/<v>/assets/poster.webp` ; placeholder `{{POSTER_CLASS}}` (vide ou `has-img`).
- Produces: `window.DC.capturePoster()`.

- [ ] **Step 1 : Boot différé dans `datacenter.js`**

Restructurer la fin du module : tout le code de construction/démarrage (`buildStatics(); buildRacks(); buildLEDs(); buildScreens(); resize(); applyLive(); raf = requestAnimationFrame(animate);`) part dans une fonction `start()`. ATTENTION : la création du renderer et de la scène reste où elle est (le `if (renderer)` englobe tout) ; seul le déclenchement change :

```js
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function start(){
  buildStatics(); buildRacks(); buildLEDs(); buildScreens();
  resize(); applyLive();
  if (window.DC_PANEL) import('./dc-panel.js').then(/* ... comme avant ... */);
  raf = requestAnimationFrame(animate);
}
if (window.DC_PANEL) {
  start();                                   // le tuner démarre toujours, tout de suite
} else if (!reduced) {
  const idle = () => ('requestIdleCallback' in window)
    ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200);
  (document.readyState === 'complete') ? idle()
    : window.addEventListener('load', idle, { once: true });
} // sinon : reduced-motion -> le poster reste, le moteur ne démarre jamais
```

Apparition en fondu : dans `animate()`, après le premier `composer.render()` :

```js
if (!canvas.classList.contains('ready')) canvas.classList.add('ready');
```

Cas WebGL absent (le `catch` existant) : ne rien changer (le poster + dégradé restent).

- [ ] **Step 2 : Capture du poster**

Dans `datacenter.js`, exposer :

```js
function capturePoster(){
  composer.render();   // frame fraîche dans le buffer (preserveDrawingBuffer est false)
  renderer.domElement.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `poster-${config.palette === 'violetPremium' ? 'pro' : 'link'}.webp`;
    a.click(); URL.revokeObjectURL(a.href);
  }, 'image/webp', 0.92);
}
window.DC = { ...existant..., capturePoster };
```

Dans `dc-panel.js`, à côté de « Copier la config » : `<button class="act" id="btn-poster">📷 Poster</button>` câblé sur `ctx.capturePoster` (ajouter `capturePoster` au ctx passé par datacenter.js).

- [ ] **Step 3 : Templates et CSS**

`src/templates/layout.html`, juste avant le canvas :

```html
<div id="poster" class="scene-poster {{POSTER_CLASS}}" aria-hidden="true"></div>
<canvas id="scene-canvas" class="scene-canvas" aria-hidden="true"></canvas>
```

`src/input.css`, à côté des `.scene-*` :

```css
.scene-poster { position: fixed; inset: 0; z-index: 0; background-color: #04060a;
  background-position: center; background-size: cover; background-repeat: no-repeat; }
.scene-poster.has-img { background-image: url('/assets/poster.webp'); }
.scene-canvas { opacity: 0; transition: opacity 1.4s ease; }
.scene-canvas.ready { opacity: 1; }
```

ATTENTION : `.scene-canvas` a déjà un bloc CSS (position fixed etc.) : y AJOUTER les 2 propriétés opacity/transition et la règle `.ready`, ne pas dupliquer le sélecteur.

- [ ] **Step 4 : `build/generate.mjs`**

Dans `buildMap()` : `POSTER_CLASS: existsSync(join(root, 'assets', `poster-${cfg.variant || name}.webp`)) ? 'has-img' : '',` : `buildMap` n'a pas `name` : passer `name` en second paramètre (`buildMap(cfg, name)`) depuis la boucle. Dans `copyAssets(cfg, assetsDir, name)` (mettre à jour ses DEUX sites d'appel dans la boucle des variantes) :

```js
const poster = join(root, 'assets', `poster-${name}.webp`);
if (existsSync(poster)) copyFileSync(poster, join(assetsDir, 'poster.webp'));
```

- [ ] **Step 5 : Générer les 2 posters**

Au tuner : palette `violet`, bg `#0B0712` (la config FROZEN link), cliquer « 📷 Poster » → enregistrer le fichier téléchargé en `assets/poster-link.webp`. Palette `violetPremium` + la config `dc` de `config/pro.json` → `assets/poster-pro.webp`. Vérifier le poids (< 150 Ko chacun, sinon baisser la qualité à 0.85 dans `capturePoster`).

- [ ] **Step 6 : Vérifier le build complet**

Run: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" && npm run build && ls apps/link/assets/poster.webp apps/pro/assets/poster.webp && grep -c "scene-poster has-img" apps/link/index.html`
Expected: build sans erreur, les 2 posters copiés, `1`.

Ouvrir http://localhost:4173/apps/link/ : le poster apparaît instantanément, la 3D fond par-dessus ~1-2 s après. DevTools > Rendering > « Emulate CSS prefers-reduced-motion » : recharger → poster seul, aucune animation, 0 % GPU. Vérifier le tuner : démarre toujours immédiatement.

- [ ] **Step 7 : Commit**

```bash
git add assets/vendor/datacenter.js assets/vendor/dc-panel.js src/templates/layout.html src/input.css build/generate.mjs assets/poster-link.webp assets/poster-pro.webp
git commit -m "feat: poster statique (chargement, reduced-motion, sans WebGL) + demarrage differe du fond"
```

---

### Task 10 : Finitions (tuner complet, configs gelées, docs, mesure finale)

**Files:**
- Modify: `assets/vendor/dc-panel.js` (toggle miroir)
- Modify: `build/generate.mjs` (FROZEN_DC)
- Modify: `config/pro.json` (bloc dc)
- Modify: `CLAUDE.md`, `README.md`, `.claude/skills/tuner/SKILL.md`

**Interfaces:**
- Consumes: toutes les clés config des tâches 3-8 : `mirror, ramp, shaft, dust, traffic, screens`.

- [ ] **Step 1 : Toggle miroir au panneau**

`dc-panel.js`, groupe Éclairage : `{ key:'mirror', label:'Reflet au sol', min:0, max:1, step:1, fmt:v=>v?'on':'off' },` (le slider 0/1 suffit, `applyLive` gère déjà). Vérifier que « Copier la config » sort bien toutes les nouvelles clés (il itère sur `DEFAULTS` : automatique).

- [ ] **Step 2 : Geler les configs**

`build/generate.mjs` : compléter `FROZEN_DC` avec les valeurs par défaut des nouvelles clés :

```js
const FROZEN_DC = { camSpeed: 0.40, blink: 1.05, density: 0.75, ledSize: 0.045, glow: 1.20,
  fog: 0.025, veil: 0.32, palette: 'violet', bg: '#0B0712',
  mirror: 1, ramp: 1.0, shaft: 0.5, dust: 0.5, traffic: 0.6, screens: 1.0 };
```

`config/pro.json` : compléter le bloc `dc` existant avec des valeurs sobres : `"mirror": 1, "ramp": 0.8, "shaft": 0.35, "dust": 0.3, "traffic": 0.4, "screens": 0.6` (si le bloc `dc` n'existe pas, ne rien faire : FROZEN_DC s'applique). Ces valeurs seront affinées par Alexandre au tuner ensuite ; le mécanisme « Copier la config » → coller ici est documenté dans `.claude/skills/tuner/SKILL.md`.

- [ ] **Step 3 : Documentation**

- `CLAUDE.md`, section « Le fond Datacenter 3D » : décrire les 3 modules (`datacenter.js`, `dc-textures.js`, `dc-panel.js`), le monde statique 2 périodes + wrap caméra, le monde miroir (plus de Reflector), l'atlas de façades, les nouvelles clés de config, le poster (`assets/poster-<variant>.webp`, copie par generate, `{{POSTER_CLASS}}`, reduced-motion, démarrage différé).
- `README.md` : même mise à jour en plus court si le fond y est décrit.
- `.claude/skills/tuner/SKILL.md` : ajouter les nouveaux sliders (groupe Éclairage : rampes, faisceaux, poussière, écrans, reflet ; LED : trafic) et le bouton « 📷 Poster » (étape 5 : où enregistrer les fichiers).

- [ ] **Step 4 : Vérification finale complète**

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
node --check assets/vendor/datacenter.js && node --check assets/vendor/dc-textures.js && node --check assets/vendor/dc-panel.js
npm run build
```
Expected: aucune erreur.

Puis, avec le serveur local (`npx --yes serve -l 4173 .`) :
1. http://localhost:4173/tuner : rendu complet, tous les sliders opérationnels, « Copier la config » sort toutes les clés, wrap invisible à vitesse 3.
2. **Mesure finale** : ms/frame ≤ baseline de la tâche 1 ET % GPU Chrome ≤ ~6-8 % à réglages par défaut. Si dépassement : baisser dans l'ordre `dust` (N=150), `samples: 4` → `2` sur le WebGLRenderTarget, résolution de l'atlas (tuiles 512x1024). Noter les chiffres dans le commit.
3. http://localhost:4173/apps/link/ et /apps/pro/ : poster → fondu 3D, cartes lisibles, palette correcte par variante, la 404 (apps/link/404.html) intacte.
4. Emulation reduced-motion : poster seul.
5. `git status` : rien d'inattendu (apps/ et tailwind.css sont gitignorés).

- [ ] **Step 5 : Commit final**

```bash
git add assets/vendor/dc-panel.js build/generate.mjs config/pro.json CLAUDE.md README.md .claude/skills/tuner/SKILL.md
git commit -m "feat: rework realiste du fond datacenter, finitions (tuner, configs gelees, docs)"
```

---

## Notes d'exécution

- **Itération visuelle attendue** : les valeurs esthétiques (opacités, intensités, tailles) sont des points de départ raisonnés, pas des vérités. À chaque tâche, ajuster au tuner jusqu'à ce que ce soit beau AVANT de committer, et reporter les valeurs ajustées dans le code (pas seulement dans la config runtime).
- **Si le % GPU dérive en cours de route** : traiter immédiatement (ne pas attendre la tâche 10). Les suspects dans l'ordre : surdraw des transparents (shafts trop grands à l'écran), MSAA `samples: 4`, taille de l'atlas.
- **Le serveur tuner** : `npx --yes serve -l 4173 .` sert la racine ; les apps générées sont sous http://localhost:4173/apps/link/ (cleanUrls actif). Hard-refresh (Cmd+Shift+R) après chaque modif de `assets/vendor/` (cache).
- **Périodicité** : règle absolue pour toute nouvelle décision aléatoire de contenu : semer par `(side, r)` ou par constante, jamais par période ni par ordre d'appel global. C'est ce qui garantit le wrap invisible.

