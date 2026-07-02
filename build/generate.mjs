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

const root = process.cwd();
const VARIANTS = ['link', 'pro'];
const copyCssOnly = process.argv.includes('--copy-css');

// Réglages validés du fond Datacenter 3D (surchargés par cfg.dc si présent dans une config).
const FROZEN_DC = { camSpeed: 0.40, blink: 1.05, density: 0.75, ledSize: 0.045, glow: 1.20,
  fog: 0.025, veil: 0.32, palette: 'violet', bg: '#0B0712',
  mirror: 1, ramp: 1.0, shaft: 0.5, dust: 0.5, traffic: 0.6, screens: 1.0 };

const layoutTpl = readFileSync(join(root, 'src/templates/layout.html'), 'utf8');
const errorTpl = readFileSync(join(root, 'src/templates/error.html'), 'utf8');

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isExternal = (url) => /^https?:/i.test(url);
const externalAttrs = (url) => (isExternal(url) ? ' target="_blank" rel="noopener"' : '');

function renderLink(link) {
  const net = networks[link.network];
  if (!net) throw new Error(`Réseau inconnu dans la config : "${link.network}"`);
  const label = link.label || net.label;
  const url = link.url;
  const attrs = externalAttrs(url);
  const iconClass = `link-icon is-${link.network}`;

  if (link.featured) {
    const subtitle = link.subtitle || url.replace(/^mailto:/i, '');
    return `            <a href="${escapeHtml(url)}"${attrs} class="link-card-featured group">
                <span class="${iconClass}">${net.svg}</span>
                <span class="flex flex-col">
                    <span class="font-bold text-sm featured-title">${escapeHtml(label)}</span>
                    <span class="text-xs text-slate-600 dark:text-slate-400">${escapeHtml(subtitle)}</span>
                </span>
            </a>`;
  }

  const labelBlock = link.subtitle
    ? `<span class="flex flex-col">
                    <span class="link-label">${escapeHtml(label)}</span>
                    <span class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(link.subtitle)}</span>
                </span>`
    : `<span class="link-label">${escapeHtml(label)}</span>`;

  return `            <a href="${escapeHtml(url)}"${attrs} class="link-card group">
                <span class="${iconClass}">${net.svg}</span>
                ${labelBlock}
            </a>`;
}

function buildMap(cfg, name) {
  const ogImageAbs = cfg.ogImage ? cfg.ogUrl.replace(/\/$/, '') + cfg.ogImage : '';
  return {
    LANG: cfg.lang || 'fr',
    TITLE: escapeHtml(cfg.title),
    DESCRIPTION: escapeHtml(cfg.description || cfg.bio || ''),
    SITE_NAME: escapeHtml(cfg.siteName || 'YouKyi'),
    THEME_COLOR: cfg.themeColor || '#0a0a0a',
    OG_URL: cfg.ogUrl,
    OG_IMAGE_ABS: ogImageAbs,
    AVATAR: cfg.avatar,
    AVATAR_ALT: escapeHtml(cfg.avatarAlt || cfg.name),
    AVATAR_SHAPE_CLASS: cfg.avatarShape === 'circle' ? 'avatar avatar--circle' : 'avatar avatar--rounded',
    NAME: escapeHtml(cfg.name),
    BIO: escapeHtml(cfg.bio || ''),
    FOOTER: escapeHtml(cfg.footer || ''),
    NAV_LABEL: escapeHtml(`Liens ${cfg.name}`),
    DC_CONFIG: JSON.stringify(cfg.dc || FROZEN_DC),
    DA_CLASS: cfg.accent === 'premium' ? 'da-premium' : '',
    POSTER_CLASS: existsSync(join(root, 'assets', `poster-${cfg.variant || name}.webp`)) ? 'has-img' : '',
    // Préchargement du poster : sans lui, la première visite (cache froid) montre un fond
    // noir le temps que le CSS déclenche le téléchargement, puis deux transitions.
    POSTER_PRELOAD: existsSync(join(root, 'assets', `poster-${cfg.variant || name}.webp`))
      ? '    <link rel="preload" href="/assets/poster.webp" as="image" type="image/webp">\n'
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
