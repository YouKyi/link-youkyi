// Essai vidéo : aucun moteur 3D chargé, lecture native du navigateur.
const video = document.createElement('video');
video.className = 'scene-video';
video.muted = true;
video.loop = true;
video.playsInline = true;
video.preload = 'none';
video.setAttribute('aria-hidden', 'true');
document.getElementById('scene-canvas').replaceWith(video);

const motion = matchMedia('(prefers-reduced-motion: reduce)');
const portrait = matchMedia('(max-aspect-ratio: 1/1)');
const veil = window.DC_CONFIG.veil;
document.getElementById('veil').style.background = `radial-gradient(ellipse 34% 76% at 50% 48%,rgba(8,10,17,${veil}) 0%,rgba(8,10,17,${veil * 0.60}) 62%,transparent 100%)`;

function update() {
  const format = portrait.matches ? 'portrait' : 'landscape';
  const src = `/assets/video/datacenter-${format}.mp4`;
  if (motion.matches) {
    video.classList.remove('ready');
    video.pause();
    if (video.hasAttribute('src')) { video.removeAttribute('src'); video.load(); }
    return;
  }
  if (document.hidden) { video.pause(); return; }
  if (video.getAttribute('src') !== src) {
    video.classList.remove('ready');
    video.src = src;
  }
  video.play().catch(() => video.classList.remove('ready'));
}
video.addEventListener('playing', () => video.classList.add('ready'));
video.addEventListener('error', () => video.classList.remove('ready'));
motion.addEventListener('change', update);
portrait.addEventListener('change', update);
document.addEventListener('visibilitychange', update);
update();
