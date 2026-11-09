import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
if (!args.length || args.at(-1) === '--posts=optional') {
  console.error('Usage: node scripts/smoke-staging.mjs [--posts=optional] <origin> [...]');
  process.exit(1);
}
const timeout = Number(process.env.SMOKE_TIMEOUT_MS ?? 180000);
const retry = Number(process.env.SMOKE_RETRY_MS ?? 5000);
if (!(timeout > 0 && retry > 0 && Number.isFinite(timeout) && Number.isFinite(retry))) {
  throw new Error('Smoke timeout and retry interval must be positive finite milliseconds');
}
const deadline = Date.now() + timeout;
let optional = false;
const targets = [];
for (const arg of args) {
  if (arg === '--posts=optional') { optional = true; continue; }
  targets.push({ origin: new URL(arg).origin, optional, results: new Map() });
  optional = false;
}

async function check(target, path) {
  const url = new URL(path, target.origin).href;
  const previous = target.results.get(url);
  if (previous?.ok) return previous;
  let result;
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))),
    });
    const body = path === '/sitemap.xml' ? await response.text() : '';
    if (path !== '/sitemap.xml') await response.body?.cancel();
    result = { ok: response.status === 200, body, message: `${response.status} ${url}` };
  } catch (error) {
    result = { ok: false, message: `ERROR ${url}: ${error.message}` };
  }
  target.results.set(url, result);
  console.log(result.message);
  return result;
}

async function checkTarget(target) {
  await Promise.all(['/', '/_emdash/admin/login', '/robots.txt', '/llms.txt', '/sitemap.xml'].map(path => check(target, path)));
  const sitemap = target.results.get(`${target.origin}/sitemap.xml`);
  if (sitemap?.ok) {
    const post = [...sitemap.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(([, loc]) => {
      try { return new URL(loc.trim()); } catch { return null; }
    }).find(url => url?.pathname.startsWith('/posts/') && url.pathname !== '/posts/');
    if (post) await check(target, post.pathname + post.search);
    else if (target.optional) console.log(`${target.origin}: no posts yet`);
    else {
      // Retry discovery too: content may become available while the domain settles.
      const message = `ERROR ${target.origin}: sitemap has no post URL`;
      console.error(message);
      target.results.set(`${target.origin}/sitemap.xml`, { ok: false, message });
    }
  }
  return [...target.results.values()].every(result => result.ok);
}

while (true) {
  const healthy = await Promise.all(targets.map(checkTarget));
  if (healthy.every(Boolean)) break;
  if (Date.now() >= deadline) {
    console.error(`Smoke checks exceeded ${timeout}ms; last result for each URL:`);
    for (const target of targets) for (const result of target.results.values()) console.error(result.message);
    process.exitCode = 1;
    break;
  }
  await delay(Math.min(retry, Math.max(1, deadline - Date.now())));
}
