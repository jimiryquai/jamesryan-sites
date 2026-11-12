import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { USERMAVEN_PROXY_PATH } from '../apps/marketing-site/src/utils/usermaven.ts';

const [origin, seedPath, evidenceDirectory] = process.argv.slice(2);
if (!origin || !seedPath) throw new Error('Usage: node scripts/check-rendered-media.mjs <origin> <seed.json> [screenshots-directory]');
const seed = JSON.parse(await readFile(seedPath, 'utf8'));
function imageAlts(value) {
  if (!value || typeof value !== 'object') return [];
  if (value.$media) return [value.$media.alt ?? ''];
  return Object.values(value).flatMap(imageAlts);
}
const sitemap = await (await fetch(new URL('/sitemap.xml', origin))).text();
const paths = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/gs)].map(match => new URL(match[1]).pathname));
// Include seeded entries even if the sitemap accidentally omits them.
const expected = new Map();
for (const [collection, entries] of Object.entries(seed.content)) {
  for (const entry of entries) {
    if (entry.status !== 'published') continue;
    const alts = imageAlts(entry.data);
    if (!alts.length) continue;
    const path = collection === 'pages' ? (entry.slug === 'home' ? '/' : `/${entry.slug}`) : `/${collection}/${entry.slug}`;
    expected.set(path, alts);
    paths.add(path);
  }
}
// Decode the entities emitted in Astro HTML attributes before comparing copy.
function decode(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, entity) => {
    if (entity.startsWith('#')) return String.fromCodePoint(entity[1].toLowerCase() === 'x'
      ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[entity.toLowerCase()];
  });
}
function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? decode(match[1] ?? match[2]) : null;
}
const report = { routes: [], images: 0, screenshots: [] };
let images = 0;
for (const path of paths) {
  const response = await fetch(new URL(path, origin));
  assert.ok(response.ok, `${path}: page failed`);
  const html = await response.text();
  const renderedAlts = [];
  for (const [tag] of html.matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const src = attribute(tag, 'src');
    assert.ok(src, `${path}: image has no src`);
    const image = await fetch(new URL(src, origin));
    assert.ok(image.ok && image.headers.get('content-type')?.startsWith('image/'), `${path}: broken image ${src}`);
    assert.ok((await image.arrayBuffer()).byteLength > 0, `${path}: empty image ${src}`);
    renderedAlts.push(attribute(tag, 'alt'));
    images++;
  }
  for (const alt of expected.get(path) ?? []) {
    const index = renderedAlts.indexOf(alt);
    assert.ok(index !== -1, `${path}: missing image with original alt ${JSON.stringify(alt)}`);
    renderedAlts.splice(index, 1);
  }
  report.routes.push({ path, originalAltValuesVerified: (expected.get(path) ?? []).length });
}
report.images = images;
report.summary = `Rendered media passed: ${paths.size} routes, ${images} loaded images`;

// Screenshots are optional local evidence; CI only needs HTTP and alt checks.
if (evidenceDirectory) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    await mkdir(evidenceDirectory, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route(`**${USERMAVEN_PROXY_PATH}/**`, route => route.abort());
    const post = [...expected.keys()].find(path => path.startsWith('/posts/'));
    for (const [name, path] of [['home', '/'], ['post', post]]) {
      if (!path) continue;
      await page.goto(new URL(path, origin).href);
      await page.locator('img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.screenshot({ path: resolve(evidenceDirectory, `${name}.png`), fullPage: true });
      report.screenshots.push(resolve(evidenceDirectory, `${name}.png`));
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify(report, null, 2));
