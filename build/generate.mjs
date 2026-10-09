// Générateur statique des variantes YouKyi (pro + link).
//
// Lit `config/<variant>.json` + `src/templates/*.html` + `data/networks.mjs`
// et écrit `apps/<variant>/{index.html, 404.html}` + copie les assets
// (avatar local + tailwind.css compilé) dans `apps/<variant>/assets/`.
//
// Zéro dépendance : pur Node (ESM). Exécuté depuis la racine du dépôt.
//   node build/generate.mjs             -> génère le HTML + copie les avatars (+ le CSS s'il existe)
//   node build/generate.mjs --copy-css  -> copie uniquement les assets (CSS + avatars) dans les apps

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { networks } from '../data/networks.mjs';
import { SCENE_DEFAULTS } from '../assets/vendor/dc-layout.mjs';

const root = process.cwd();
const VARIANTS = ['link', 'pro'];
const copyCssOnly = process.argv.includes('--copy-css');

const layoutTpl = readFileSync(join(root, 'src/templates/layout.html'), 'utf8');
const errorTpl = readFileSync(join(root, 'src/templates/error.html'), 'utf8');
const brandDir = join(root, 'assets/vendor/youkyi-brand/assets');
const brandLogo = readFileSync(join(brandDir, 'logo/lockup-b-horizontal.svg'), 'utf8');
const brandWordmark = readFileSync(join(brandDir, 'logo/wordmark.svg'), 'utf8');
const mailIcon = readFileSync(join(brandDir, 'icons-lucide/mail.svg'), 'utf8');
const backIcon = readFileSync(join(brandDir, 'icons-lucide/arrow-left.svg'), 'utf8');

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isExternal = (url) => /^https?:/i.test(url);
// `me: true` dans la config ajoute rel="me" (vérification de domaine Mastodon / IndieAuth).
const linkAttrs = (link) => {
  const rel = [link.me ? 'me' : '', isExternal(link.url) ? 'noopener' : ''].filter(Boolean).join(' ');
  const target = isExternal(link.url) ? ' target="_blank"' : '';
  return `${target}${rel ? ` rel="${rel}"` : ''}`;
};

function renderLink(link) {
  const net = networks[link.network];
  if (!net) throw new Error(`Réseau inconnu dans la config : "${link.network}"`);
  const label = link.label || net.label;
  const url = link.url;
  const attrs = linkAttrs(link);
  const icon = link.network === 'mail' ? mailIcon : net.svg;

  if (link.featured) {
    const subtitle = link.subtitle || url.replace(/^mailto:/i, '');
    return `            <a href="${escapeHtml(url)}"${attrs} class="link-card-featured">
                <span class="link-icon is-${link.network}" aria-hidden="true">${icon}</span>
                <span class="link-copy">
                    <span class="featured-title">${escapeHtml(label)}</span>
                    <span class="link-subtitle">${escapeHtml(subtitle)}</span>
                </span>
            </a>`;
  }

  const labelBlock = link.subtitle
    ? `<span class="link-copy">
                    <span class="link-label">${escapeHtml(label)}</span>
                    <span class="link-subtitle">${escapeHtml(link.subtitle)}</span>
                </span>`
    : `<span class="link-label">${escapeHtml(label)}</span>`;

  return `            <a href="${escapeHtml(url)}"${attrs} class="link-card">
                <span class="link-icon is-${link.network}" aria-hidden="true">${icon}</span>
                ${labelBlock}
                <span class="link-arrow" aria-hidden="true">›</span>
            </a>`;
}

function buildMap(cfg, name) {
  const ogImageAbs = cfg.ogImage ? cfg.ogUrl.replace(/\/$/, '') + cfg.ogImage : '';
  return {
    LANG: cfg.lang || 'fr',
    TITLE: escapeHtml(cfg.title),
    DESCRIPTION: escapeHtml(cfg.description || cfg.bio || ''),
    SITE_NAME: escapeHtml(cfg.siteName || 'youkyi'),
    THEME_COLOR: cfg.themeColor || '#0a0a0a',
    OG_URL: cfg.ogUrl,
    OG_IMAGE_ABS: ogImageAbs,
    AVATAR: cfg.avatar,
    AVATAR_ALT: escapeHtml(cfg.avatarAlt || cfg.name),
    PROFILE_HEADING: name === 'link'
      ? `<h1 class="profile-logo" aria-label="${escapeHtml(cfg.name)}"><span aria-hidden="true">${brandLogo}</span></h1>`
      : `<img src="${escapeHtml(cfg.avatar)}" alt="${escapeHtml(cfg.avatarAlt || cfg.name)}" width="88" height="88" class="avatar">
            <h1 class="profile-title">${escapeHtml(cfg.name)}</h1>`,
    BRAND_SIGNATURE: name === 'pro' ? `<div class="brand-signature" role="img" aria-label="youkyi"><span aria-hidden="true">${brandWordmark}</span></div>` : '',
    BACK_ICON: backIcon,
    BIO: escapeHtml(cfg.bio || ''),
    FOOTER: escapeHtml(cfg.footer || ''),
    NAV_LABEL: escapeHtml(`Liens ${cfg.name}`),
    DC_CONFIG: JSON.stringify(cfg.dc || SCENE_DEFAULTS),
    POSTER_CLASS: existsSync(join(root, 'assets', `poster-${cfg.variant || name}.webp`)) ? 'has-img' : '',
    // Choisir le poster avant le CSS, sans charger Three.js ni télécharger les deux rendus.
    POSTER_PRELOAD: existsSync(join(root, 'assets', `poster-${cfg.variant || name}.webp`))
      ? `    <script>
        (() => {
            const requested = new URLSearchParams(location.search).get('render');
            const hardware = (requested === 'hardware' || (requested !== 'graphite' && ${cfg.dc?.rackStyle === 'hardware'})) && ${existsSync(join(root, 'assets', `poster-hardware-${cfg.variant || name}.webp`))};
            document.documentElement.dataset.rackStyle = hardware ? 'hardware' : 'graphite';
            const video = new URLSearchParams(location.search).get('background') === 'video';
            if (video) document.documentElement.dataset.background = 'video';
            const format = matchMedia('(max-aspect-ratio: 1/1)').matches ? 'portrait' : 'landscape';
            const preload = document.createElement('link');
            Object.assign(preload, { rel: 'preload', as: 'image', type: 'image/webp', href: video ? '/assets/video/poster-' + format + '.webp' : hardware ? '/assets/poster-hardware.webp' : '/assets/poster.webp' });
            document.head.appendChild(preload);
        })();
    </script>\n`
      : '',
    LINKS: cfg.links.map(renderLink).join('\n'),
  };
}

const fill = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : ''));

function copyAssets(cfg, assetsDir, name) {
  mkdirSync(assetsDir, { recursive: true });
  // Avatar local
  if (cfg.avatar && cfg.avatar.startsWith('/assets/')) {
    const file = basename(cfg.avatar);
    const src = join(root, 'assets', file);
    if (existsSync(src)) copyFileSync(src, join(assetsDir, file));
  }
  // Poster statique (généré manuellement via le tuner ; absent = pas de copie, {{POSTER_CLASS}} vide)
  const poster = join(root, 'assets', `poster-${cfg.variant || name}.webp`);
  if (existsSync(poster)) copyFileSync(poster, join(assetsDir, 'poster.webp'));
  const hardwarePoster = join(root, 'assets', `poster-hardware-${cfg.variant || name}.webp`);
  if (existsSync(hardwarePoster)) copyFileSync(hardwarePoster, join(assetsDir, 'poster-hardware.webp'));
  const videoDir = join(assetsDir, 'video');
  mkdirSync(videoDir, { recursive: true });
  for (const format of ['landscape', 'portrait']) {
    for (const file of [`datacenter-${format}.mp4`, `poster-${format}.webp`]) {
      const source = join(root, 'assets', 'video', file);
      if (existsSync(source)) copyFileSync(source, join(videoDir, file));
    }
  }
  // CSS compilé (présent seulement après le build Tailwind)
  const css = join(root, 'assets', 'tailwind.css');
  if (existsSync(css)) copyFileSync(css, join(assetsDir, 'tailwind.css'));
  // Three.js auto-hébergé + moteur du fond (assets/vendor -> apps/<v>/assets/vendor)
  const vendorSrc = join(root, 'assets', 'vendor');
  if (existsSync(vendorSrc)) cpSync(vendorSrc, join(assetsDir, 'vendor'), { recursive: true });
}

function loadConfig(name) {
  return JSON.parse(readFileSync(join(root, 'config', `${name}.json`), 'utf8'));
}

for (const name of VARIANTS) {
  const cfg = loadConfig(name);
  const outDir = join(root, 'apps', cfg.variant || name);
  const assetsDir = join(outDir, 'assets');

  if (copyCssOnly) {
    copyAssets(cfg, assetsDir, name);
    continue;
  }

  const map = buildMap(cfg, name);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), fill(layoutTpl, map));
  writeFileSync(join(outDir, '404.html'), fill(errorTpl, map));
  copyAssets(cfg, assetsDir, name);
}

console.log(copyCssOnly ? 'Assets copiés dans apps/*.' : `Apps générées : ${VARIANTS.join(', ')}.`);
