import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Rows come from a read-only SELECT on the source site's media table.
export function rewriteSeedMedia(seed, mediaRows) {
  const downloads = new Map();
  function media(value, metadata = {}) {
    const row = mediaRows.find(row => row.id === (value.id ?? value._ref) ||
      (value.src ?? value.url)?.endsWith(`/${row.storage_key}`));
    const url = row ? `/_emdash/api/media/file/${row.storage_key}` : value.src ?? value.url;
    if (!url) throw new Error(`No media source for ${JSON.stringify(value)}`);
    const file = `assets/${basename(row?.filename ?? new URL(url, 'https://source.invalid').pathname)}`;
    if (downloads.has(file) && downloads.get(file) !== url) {
      throw new Error(`Different media sources share ${file}`);
    }
    downloads.set(file, url);
    const reference = { file };
    const alt = metadata.alt ?? value.alt ?? row?.alt;
    if (alt != null) reference.alt = alt;
    const caption = metadata.caption ?? value.caption;
    if (caption !== undefined) reference.caption = caption;
    if (row) reference.libraryCaption = row.caption;
    return { $media: reference };
  }
  function walk(value) {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== 'object' || value.$media?.file) return value;
    if (value._type === 'image' && value.asset) {
      return value.asset.$media?.file ? value : { ...value, asset: media(value.asset, value) };
    }
    if (value.$media) return media(value.$media);
    if (value.provider === 'local' && value.id) return media(value);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child)]));
  }
  return { seed: walk(seed), downloads: [...downloads].map(([file, url]) => ({ file, url })) };
}

async function main() {
  const [seedPath, rowsPath, origin] = process.argv.slice(2);
  if (!seedPath || !rowsPath || !origin) {
    throw new Error('Usage: node scripts/seed-media.mjs <seed.json> <wrangler-media-rows.json> <source-origin>');
  }
  const rows = JSON.parse(await readFile(rowsPath, 'utf8'));
  const { seed, downloads } = rewriteSeedMedia(JSON.parse(await readFile(seedPath, 'utf8')), rows[0].results);
  for (const { file, url } of downloads) {
    const response = await fetch(new URL(url, origin));
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      throw new Error(`Image download failed: ${url} (HTTP ${response.status})`);
    }
    const target = resolve(dirname(seedPath), file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
  // Also verify files on reruns of an already rewritten seed.
  async function verify(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$media?.file) await access(resolve(dirname(seedPath), value.$media.file));
    await Promise.all(Object.values(value).map(verify));
  }
  await verify(seed);
  await writeFile(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(JSON.stringify({ seed: seedPath, downloads }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
