# link-youkyi

Pages de liens (« link in bio ») de **YouKyi**, en HTML statique + Tailwind CSS, avec un **fond 3D animé de datacenter** (Three.js auto-hébergé). Le contenu est décrit en JSON et un petit script Node génère les pages. Déployé sur Vercel.

Deux variantes, une source unique, **thème sombre uniquement** :

| Variante | Profil | Liens | Domaines visés |
|---|---|---|---|
| `link` | « youkyi » (logo officiel), 9 liens | LinkedIn, Instagram, Threads, Mastodon, X, YouTube, Facebook, GitHub, Mail | `youkyi.fr`, `link.youkyi.fr` |
| `pro` | « Alexandre Agasseau » (photo), 5 liens | LinkedIn, X, Mastodon, GitHub, Mail | `pro.youkyi.fr` |

## Architecture

```
config/<variant>.json   Contenu d'une variante (nom, bio, avatar, liste de liens, og)
data/networks.mjs       Map réseau -> { label, svg } (SVG inline)
src/templates/          layout.html (page) + error.html (404), avec {{placeholders}}
src/input.css           Mise en page : cartes glassmorph, accents orange, scène, avatar, 404
tailwind.config.js      Content -> apps/ + templates + data
build/generate.mjs      Générateur (ESM, zéro dépendance)
assets/                 Avatars (logo-youkyi.png, alexandre.jpg) + poster-<variant>.webp (optionnels)
                        + vendor/ (Three.js, moteur du fond et youkyi-brand)
apps/                   SORTIE GÉNÉRÉE (gitignorée) : apps/link, apps/pro
vercel.json             cleanUrls + en-têtes de sécurité (CSP, HSTS…) partagés
```

`apps/` et `assets/tailwind.css` sont **générés** (gitignorés), reconstruits par `npm run build` en local et sur Vercel. `assets/vendor/` (Three.js + moteur) est **versionné** et copié dans chaque variante au build.

## Identité officielle

Les deux pages et la 404 reprennent les ressources de `youkyi-brand` (dépôt v2.1.1, design system 2.0.2), copiées dans `assets/vendor/youkyi-brand/`. **Alexandre a explicitement demandé de conserver le glassmorphism** : cartes transparentes, flou d'arrière-plan et reflets, avec l'orange en petites touches sur le contact et le focus. Aucun aplat orange ne remplace le verre. À sa demande, l'interface retrouve la police système d'origine de `link` (pile sans-serif par défaut de Tailwind). IBM Plex Mono est réservé au diagnostic de la 404.

Le lockup B officiel remplace l'ancien logo de la page publique ; la page professionnelle garde le portrait avec une signature youkyi en pied. Les SVG scellés sont repris sans modifier leurs tracés. Les logos sociaux conservent leurs couleurs ; les pictogrammes d'interface viennent du kit Lucide. Une paire de rampes sur quatre est orange dans la scène 3D, avec un léger éclairage latéral chaud. Les voyants des équipements conservent leurs couleurs et leur animation.

La carte « Écrivez-moi » reprend les marges, le verre et le cadre d'icône des autres liens : titre blanc, adresse en dessous et petite enveloppe orange, sans flèche. Les autres liens retrouvent le chevron d'origine « › », gris au repos et orange au survol. Les cartes ont un fond à 28 % d'opacité et un flou de 14 px.

## Le fond Datacenter 3D

Deux rendus partageant la même implantation, la même caméra et le même éclairage :

- **A · Façades graphite** (`graphite`, par défaut) : façades texturées, montants, portes encadrées, poignées et séparations en volume.
- **B · Serveurs en volume** (`hardware`) : équipements génériques dans des baies 42U, châssis 1U/2U de 444 mm avec oreilles de fixation, tiroirs SFF/LFF, stockage 4U, grilles, vis, ports creux et cordons de brassage. Les petites pièces sont modélisées jusqu'à 16 mètres ; les mêmes façades restent visibles au-delà.

Les agencements 8/16 SFF et 12 LFF s'inspirent des [configurations du Dell PowerEdge R750](https://www.dell.com/community/assets/community/687062f5-603c-4f5f-ab9d-31aa7cacb376/PER750configguide.pdf-a42967c4-9b6e-49a6-ab59-34359d2fc228-259117075.pdf). Ce sont des modèles procéduraux génériques, pas des modèles officiels importés.

Chaque baie comporte aussi un switch 24 ports à hauteur du regard et deux switches 48 ports en partie haute, avec panneaux de brassage et cordons. Leurs façades métalliques claires, petits afficheurs, ports RJ45/SFP et voyants les distinguent des serveurs. Les combinaisons 24 RJ45 + 2 SFP et 48 RJ45 + 4 SFP s'inspirent de la [gamme UniFi Pro](https://dl.ui.com/ds/usw-pro-ds.pdf), sans reproduire un modèle de marque.

`dc-layout.mjs` définit les dimensions, huit implantations déterministes et les réglages `SCENE_DEFAULTS`. Les textures, modèles et LED utilisent cette implantation commune. `dc-racks.js` fusionne les pièces par matériau puis les instancie. `datacenter.js` assemble la scène et anime la caméra ; `dc-textures.js` dessine les textures ; `dc-panel.js` est réservé au comparateur.

Le travelling parcourt deux sections identiques avant de revenir d'une période. Éclairage des arêtes par un environnement métallique local, rampes de plafond, sol en dalles satiné et brouillard. Les voyants d'activité des disques et des ports clignotent indépendamment ; ceux d'alimentation restent fixes. Les reflets utilisent des façades inversées sous le sol, sans seconde caméra. Le cadrage s'adapte au portrait. Le rendu suit le rafraîchissement du navigateur, utilise un anticrénelage MSAA jusqu'à 4× et une résolution plafonnée à 2560 × 1600, s'arrête dans un onglet masqué et respecte la réduction des mouvements.

Three.js r160 et ses addons sont **auto-hébergés** : aucun modèle, texture ou script distant ajouté. Les paramètres partagés vivent dans `SCENE_DEFAULTS`, avec surcharge par `config/<variant>.json` → `dc`.

### Optimisations de performance

Les sommets partagés des baies sont conservés, les buffers de profondeur sont réservés à la scène 3D et les implantations/couleurs des LED sont réutilisées. Les détails, textures, reflets, MSAA et résolution sont conservés. Le kit de marque est regroupé avec les styles locaux par PostCSS, sans modifier ses fichiers ni ajouter de dépendance. Le bon poster est préchargé avant le CSS ; les modules 3D ne sont téléchargés que si les mouvements sont autorisés.

Mesures locales du 8 septembre 2026, rendu `hardware` :

| Mesure | Avant | Après |
|---|---:|---:|
| Feuilles CSS téléchargées | 14 | 1 |
| CSS décompressé | 89 247 octets | 58 020 octets (−35 %) |
| Données des géométries des baies, attributs et index | 36 028 344 octets | 28 940 708 octets (−19,7 %) |
| Modules 3D en réduction des mouvements | Chargés | Aucun |

La comparaison des attributs de tous les triangles après expansion des index donne le même SHA-256 avant/après : `57f4d2f5850e8f1b0af3fe5d5cb33703a3b2d36a482b9be0aad99fea74089c34`. Les tests vérifient aussi les index, l'orientation des reflets et les URL des ressources CSS regroupées.

Le chronométrage [GPU asynchrone](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query) a été effectué sur Apple M5, buffer 2560 × 1440, MSAA 4×, caméra au départ : 20 images mesurées après 4 images de chauffe. Médiane avant : 46,7 ms ; premier relevé après : 34,9 ms ; répétition : 45,7 ms. Cette variabilité ne permet pas d'annoncer un gain fiable en FPS. Ce sont des relevés locaux du rendu WebGL, distincts du temps CPU et de la composition du verre par le navigateur.

### Comparer les rendus

```bash
npm run tune
# http://localhost:4173/tuner.html?render=graphite
# http://localhost:4173/tuner.html?render=hardware
# Ajouter &profile=pro pour les réglages de la page professionnelle.
```

Les boutons A/B conservent le point de vue. Pause, retour au départ, vue rapprochée « Voir une baie » et réglages de lumière permettent une comparaison directe. La vue rapprochée arrête la caméra en laissant les voyants actifs. Le panneau affiche les appels de rendu et triangles de toute l'image ; le temps CPU comprend la préparation et la soumission du rendu, **pas une mesure GPU**.

Les pages générées acceptent aussi `?render=hardware`. Pour changer le rendu par défaut, définir `dc.rackStyle` dans la configuration concernée. Les posters `assets/poster-{link,pro}.webp` et `assets/poster-hardware-{link,pro}.webp` sont capturés depuis la scène réelle, au départ du travelling. Ils assurent le repli pendant le chargement, sans WebGL et lorsque les mouvements sont réduits. Le bouton « Capturer le poster » du tuner exporte le rendu sélectionné.

## Essai du fond vidéo

Ajouter `?background=video&render=hardware` à la page pour comparer le fond MP4 au moteur 3D par défaut. Les cartes restent en HTML/CSS. La vidéo hardware est commune aux deux pages, avec un cadrage paysage 1920 × 1080 et portrait 720 × 1280. Elle dure 18 secondes à 30 images/s, sans audio. Un léger aller-retour remplace le travelling continu pour raccorder caméra, poussière et activité des voyants.

Le lecteur natif suspend la lecture quand la page est masquée. Avec les mouvements réduits, seul le poster WebP s'affiche, sans téléchargement du MP4 ni de Three.js. Si la lecture automatique échoue, le poster reste affiché. Le contrôle du lecteur se lance avec `node build/check-video.mjs`.

Export du 8 septembre 2026 : 9,91 Mo en paysage et 3,98 Mo en portrait (un seul cadrage chargé). Le gain attendu concerne le calcul 3D en direct, pas le volume téléchargé. Contrôles effectués : 540 images par fichier, MP4 faststart, aucune piste audio, images paysage rendues à t=0 et t=18 identiques pixel par pixel, aucun module Three.js en mode vidéo et aucun MP4 avec les mouvements réduits. Dans l'onglet automatisé du navigateur intégré, deux boucles sans erreur en 37,9 s, mais 431 images sautées sur 1 131 : le gain de fluidité n'est pas validé par ce contrôle.

Pour refaire les fichiers (Node et FFmpeg locaux), lancer `node build/export-video.mjs`, ouvrir la page locale `http://127.0.0.1:4198/?render=hardware` au cadrage souhaité, puis exécuter dans sa console :

```js
const name = 'landscape'; // ou portrait ; viewport 1920×1080 ou 720×1280, DPR 1
const post = async (action, body) => {
  const response = await fetch(`http://127.0.0.1:4200/${action}/${name}`, { method: 'POST', body });
  if (!response.ok) throw new Error(await response.text());
};
DC.setPaused(true);
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const canvas = document.querySelector('canvas');
const size = [canvas.width, canvas.height];
let exporting = true;
requestAnimationFrame(function tick() { if (exporting) requestAnimationFrame(tick); });
try {
  await post('start');
  for (let frame = 0; frame < 540; frame++) {
    if (canvas.width !== size[0] || canvas.height !== size[1]) throw new Error('Viewport modifié pendant la capture');
    await post('frame', await DC.captureVideoFrame(frame / 30, 18));
  }
  await post('finish');
} finally { exporting = false; DC.resetView(); DC.setPaused(false); }
```

Les PNG de contrôle `*-first.png` et `*-last.png` sont temporaires ; générer les posters avec `cwebp -q 88 assets/video/landscape-first.png -o assets/video/poster-landscape.webp` (puis portrait), puis les retirer. Le build ne copie que les deux MP4 et les deux posters WebP. Arrêter le serveur d'export après usage. Les exports sont versionnés : aucun encodage vidéo dans le build de déploiement.

## Modifier le contenu

- **Ajouter / retirer / réordonner un lien** : éditer le tableau `links` de `config/link.json` ou `config/pro.json` (l'ordre du tableau = l'ordre d'affichage).
- **Nouveau réseau** : ajouter son entrée (libellé + SVG en `currentColor`) dans `data/networks.mjs`, le référencer dans une config. La couleur éventuelle se définit avec `.is-<reseau> svg` dans `src/input.css`.
- **Texte commun, styles, footer** : `src/templates/layout.html` et `src/input.css` (modifiés une seule fois pour les deux variantes).
- **Réglage du fond 3D** : `SCENE_DEFAULTS` dans `assets/vendor/dc-layout.mjs`, ou `dc` dans la configuration de la variante.

### Vérification de domaine (Mastodon, IndieAuth)

Un lien portant `"me": true` dans sa config est généré avec `rel="me"` :

```json
{ "network": "mastodon", "url": "https://mastodon.social/@youkyi", "me": true }
```

```html
<a href="https://mastodon.social/@youkyi" target="_blank" rel="me noopener" class="link-card">
```

Le HTML étant statique, le lien est lisible sans exécuter de JavaScript, ce qu'exige Mastodon. Côté Mastodon, la vérification ne se déclenche qu'après avoir ajouté le domaine (`https://youkyi.fr`, `https://pro.youkyi.fr`) dans un champ métadonnées du profil, puis ré-enregistré le profil.

## Build & développement local

```bash
npm install        # une fois
npm test           # scène, build complet, destinations des liens, logos et assets locaux
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
