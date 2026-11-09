import { pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';

/** Convert the home hero without mutating the supplied page or hiding siblings. */
export function convertHome(data) {
  const content = data.content ?? [];
  const heroes = content.filter((block) => block._type === 'marketing.hero');
  if (data.layout?.length) {
    if (!heroes.length && data.layout.some((block) => block._type === 'hero')) return null;
    throw new Error('Home already has a layout; inspect it before migrating');
  }
  if (heroes.length !== 1 || content.length !== 1) {
    throw new Error('Expected home content to contain exactly one marketing.hero; migrate other blocks separately before switching to layout');
  }
  const hero = heroes[0];
  if (!hero._key || typeof hero.headline !== 'string' || !hero.headline.trim()) {
    throw new Error('Home hero requires a key and headline');
  }
  const centered = hero.centered === true || hero.centered === 'true';
  if (!centered && hero.variation === 'pricing-hero-multi-tier') {
    throw new Error('A pricing hero needs separate hero and pricing blocks; inspect before migrating');
  }
  const links = [];
  for (const prefix of ['primaryCta', 'secondaryCta']) {
    const label = hero[`${prefix}Label`];
    const url = hero[`${prefix}Url`];
    if (Boolean(label) !== Boolean(url)) throw new Error(`Incomplete ${prefix} link`);
    if (label && url) links.push({ label, url });
  }
  // The seed's centered hero needs no image. Legacy photo URLs/demo artwork
  // need a real EmDash media value, so refuse instead of silently losing them.
  if (!centered) throw new Error('Non-centered hero requires an EmDash image before migration; inspect the photo/demo artwork');
  return {
    content: [],
    layout: [{
      _type: 'hero', _key: hero._key, _version: 1,
      variant: 'centered', heading: hero.headline, body: hero.subheadline ?? '', links,
      ...(hero.eyebrowText ? { eyebrow: hero.eyebrowText } : {}),
      ...(hero.eyebrowUrl ? { eyebrow_url: hero.eyebrowUrl } : {}),
      ...(hero.eyebrowCta ? { eyebrow_action: hero.eyebrowCta } : {}),
    }],
  };
}

/** Plan by default; callers can inject HTTP without a site or credentials. */
export async function migrateHome({ site, token, apply = false, http = fetch }) {
  const base = new URL(site);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Expected an HTTP(S) site URL without embedded credentials');
  if (!token) throw new Error('EMDASH_TOKEN is required');
  async function request(path, method = 'GET', body) {
    const response = await http(new URL(path, base), {
      method, redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      const error = new Error(`${method} ${path}: ${result.error?.message ?? response.statusText}`);
      Object.assign(error, { operation: `${method} ${path}`, status: response.status, code: result.error?.code });
      throw error;
    }
    return result.data;
  }
  const current = await request('/_emdash/api/content/pages/home');
  const page = current.item;
  if (!page || page.slug !== 'home') throw new Error('Expected the home page');
  const data = convertHome(page.data);
  const result = { site: base.origin, collection: 'pages', id: page.id, slug: page.slug,
    action: data ? 'move-hero-to-layout' : 'unchanged', applied: false, revision: current._rev, changes: data };
  if (!data) return result;
  if (!current._rev) throw new Error('Home response has no _rev; refusing an unguarded write');
  if (apply) {
    const path = `/_emdash/api/content/pages/${encodeURIComponent(page.id)}`;
    const updated = await request(path, 'PUT', { data, _rev: current._rev });
    const verified = await request(path);
    if (!isDeepStrictEqual(verified.item.data.layout, updated.item.data.layout)
      || verified.item.data.content.length !== 0) throw new Error('Home read-back did not match the migration write');
    return { ...result, applied: true, revision: verified._rev, changes: {
      layout: verified.item.data.layout, content: verified.item.data.content,
    } };
  }
  return result;
}

export async function main(argv, { token = process.env.EMDASH_TOKEN, http = fetch, out = console.log } = {}) {
  try {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { apply: { type: 'boolean' } } });
    if (positionals.length !== 1) throw new Error('usage: node scripts/move-home-hero-to-layout.mjs <site-url> [--apply]');
    out(JSON.stringify(await migrateHome({ site: positionals[0], token, http, apply: values.apply }), null, 2));
    return 0;
  } catch (error) {
    out(JSON.stringify({ errors: [{ message: error.message, operation: error.operation, status: error.status, code: error.code }] }, null, 2));
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
