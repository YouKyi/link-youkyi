---
name: tuner
description: Lance le tuner local du fond 3D datacenter (panneau de réglage live : sliders, palette, couleur de fond, « Copier la config »). À utiliser quand l'utilisateur veut régler, ajuster ou montrer le fond 3D animé du projet link-youkyi.
---

# Lancer le tuner du fond 3D

`tuner.html` (racine du repo) est une page autonome : elle charge la scène 3D
(`assets/vendor/*`, versionné) avec le panneau de réglage activé
(`window.DC_PANEL = true`). Aucun build Tailwind requis, elle ne dépend que des
assets versionnés.

## Étapes

1. Démarre le serveur statique à la racine du repo, **en arrière-plan** :

   ```
   npm run tune
   ```

   (équivaut à `npx --yes serve -l 4173 .`)

2. Attends qu'il réponde (HTTP 200 sur `http://localhost:4173/tuner.html`).
3. Donne l'URL à l'utilisateur, en clair : **http://localhost:4173/tuner.html**
4. Rappelle l'usage du panneau (en haut à droite) :
   - **Sliders** : vitesse caméra, brouillard, clignotement, densité, taille des LED, bloom/lueur, voile central.
   - **Ambiance LED** : palette (`violet` = link néon, `violetPremium` = pro sobre, plus vert/bleu/multi/cyan/ambre/chaud).
   - **Couleur de fond**.
   - **↻ Régénérer** (nouveau seed) et **⧉ Copier la config** (copie le JSON dans le presse-papier).
5. Où coller le JSON copié :
   - **link** (néon) → objet `FROZEN_DC` dans `build/generate.mjs`.
   - **pro** (sobre) → bloc `dc` dans `config/pro.json`.
   - Puis `npm run build` pour appliquer.

## Arrêter

Couper le serveur sur le port 4173 (ex. `Get-NetTCPConnection -LocalPort 4173`
puis `Stop-Process`, ou fermer le process `serve`).

## Notes

- La page `tuner.html` et le panneau ne sont PAS déployés en prod (la prod n'inclut
  pas le scaffold du panneau ni `DC_PANEL`). C'est un outil de dev local uniquement.
- `buildPanel()` vit dans `assets/vendor/datacenter.js` ; `tuner.html` ne fait que
  fournir le DOM (`#controls`, `#panel`, `#toast`, `#toggle-panel`) + le CSS + `DC_PANEL`.
