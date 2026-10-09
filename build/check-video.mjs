import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Le lecteur doit respecter les mouvements réduits, la visibilité et le cadrage.
const classes = new Set();
const video = {
  classList: { add: key => classes.add(key), remove: key => classes.delete(key) },
  setAttribute() {}, addEventListener() {},
  getAttribute() { return this.src; }, hasAttribute() { return !!this.src; },
  removeAttribute() { delete this.src; }, load() {},
  pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); },
};
const motion = { matches: true, addEventListener(_, fn) { this.change = fn; } };
const portrait = { matches: false, addEventListener(_, fn) { this.change = fn; } };
const document = {
  hidden: false, createElement: () => video,
  getElementById: () => ({ replaceWith() {}, style: {} }),
  addEventListener(_, fn) { this.change = fn; },
};
runInNewContext(readFileSync(new URL('../assets/vendor/dc-video.js', import.meta.url), 'utf8'), {
  document, window: { DC_CONFIG: { veil: 0.3 } },
  matchMedia: query => query.includes('reduced-motion') ? motion : portrait,
});
assert(!video.src, 'Aucun MP4 téléchargé avec les mouvements réduits');
motion.matches = false; motion.change();
assert(video.src.endsWith('landscape.mp4') && !video.paused);
document.hidden = true; document.change();
assert(video.paused, 'Lecture suspendue quand la page est masquée');
document.hidden = false; document.change();
assert(!video.paused, 'Lecture reprise au retour');
portrait.matches = true; portrait.change();
assert(video.src.endsWith('portrait.mp4'), 'Vidéo adaptée au cadrage vertical');
classes.add('ready'); motion.matches = true; motion.change();
assert(!video.src && video.paused && !classes.has('ready'), 'Retour au poster sans téléchargement');
console.log('Vidéo : mouvements réduits, pause/reprise et cadrage vérifiés.');
