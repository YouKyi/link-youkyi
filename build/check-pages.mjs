import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const logo = read('assets/vendor/youkyi-brand/assets/logo/lockup-b-horizontal.svg');
const wordmark = read('assets/vendor/youkyi-brand/assets/logo/wordmark.svg');
for (const variant of ['link', 'pro']) {
  const cfg = JSON.parse(read(`config/${variant}.json`));
  const page = read(`apps/${variant}/index.html`);
  const css = read(`apps/${variant}/assets/tailwind.css`);
  assert(!/@import\b/.test(css), 'Les imports CSS doivent être résolus au build');
  for (const [, path] of css.matchAll(/url\(["']?(\/assets\/[^"')]+)["']?\)/g)) {
    assert(existsSync(new URL(`../apps/${variant}${path}`, import.meta.url)), `Asset CSS manquant après regroupement : ${path}`);
  }
  const nav = page.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)[1];
  const links = [...nav.matchAll(/<a href="([^"]+)"([^>]+)>/g)];
  assert.deepEqual(links.map(link => link[1].replaceAll('&amp;', '&')), cfg.links.map(link => link.url), `${variant} : destinations et ordre conservés`);
  assert.equal((nav.match(/class="link-card-featured"/g) || []).length, 1, 'Un seul contact principal');
  cfg.links.forEach((link, i) => {
    if (link.me) assert.match(links[i][2], /rel="me(?: |")/, 'Vérification Mastodon conservée');
    if (/^https?:/i.test(link.url)) assert.match(links[i][2], /rel="[^"]*noopener/, 'Protection des liens externes');
  });
  assert(!page.includes('{{'), 'Tous les placeholders sont remplis');
  if (variant === 'link') assert(page.includes(logo), 'Lockup officiel intact');
  else {
    assert(page.includes(wordmark), 'Signature officielle intacte');
    assert(page.includes(`src="${cfg.avatar}"`), 'Portrait professionnel conservé');
  }
  for (const file of ['index.html', '404.html']) {
    for (const [, path] of read(`apps/${variant}/${file}`).matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
      assert(existsSync(new URL(`../apps/${variant}${path}`, import.meta.url)), `Asset local manquant : ${path}`);
    }
  }
}
console.log('Pages : destinations, contact unique, liens sécurisés, logos officiels, portrait et assets locaux vérifiés.');
