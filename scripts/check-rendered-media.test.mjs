import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const seed = { content: {
  pages: [{ slug: 'home', status: 'published', data: { layout: [{ _type: 'posts', variant: 'featured-grid' }] } }],
  posts: [{ slug: 'example', status: 'published', data: { featured_image: { $media: { file: 'cover.webp', alt: 'Cover' } } } }],
} };

async function checkMedia(render) {
  const directory = await mkdtemp(join(tmpdir(), 'responsive-media-'));
  const seedPath = join(directory, 'seed.json');
  await writeFile(seedPath, JSON.stringify(seed));
  const server = createServer((request, response) => {
    if (request.url.startsWith('/_image?')) {
      response.writeHead(200, { 'content-type': 'image/webp' });
      response.end('image bytes');
    } else if (request.url === '/sitemap.xml') {
      response.end('<loc>https://example.com/</loc><loc>https://example.com/posts/example</loc>');
    } else {
      response.end(render(request.url));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const child = spawn(process.execPath, ['scripts/check-rendered-media.mjs', `http://127.0.0.1:${server.address().port}`, seedPath], { timeout: 15000 });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const [code] = await once(child, 'close');
    return { code, output };
  } finally {
    server.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function renderImage(path, priority = true) {
  const sizes = path === '/' ? '(min-width: 1024px) 720px, calc(100vw - 3rem)' : '(min-width: 1280px) 1200px, calc(100vw - 3rem)';
  return `<img src="/_image?w=1200" width="1200" height="750" srcset="/_image?w=640 640w, /_image?w=1200 1200w" sizes="${sizes}" alt="Cover" ${priority ? 'fetchpriority="high"' : ''}>`;
}

test('rendered media checker rejects missing LCP priority and preload on seeded home and post', async () => {
  const result = await checkMedia(path => renderImage(path, false));
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /LCP.*priority|LCP.*preload/);
});

function renderPreload(path) {
  const sizes = path === '/' ? '(min-width: 1024px) 720px, calc(100vw - 3rem)' : '(min-width: 1280px) 1200px, calc(100vw - 3rem)';
  return `<link rel="preload" as="image" href="/_image?w=1200" imagesrcset="/_image?w=640 640w, /_image?w=1200 1200w" imagesizes="${sizes}">`;
}

test('rendered media checker verifies home and post preloads and loads responsive candidates', async () => {
  const result = await checkMedia(path => renderPreload(path) + renderImage(path));
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /2 responsive images, 2 matching preloads/);
});

test('rendered media checker rejects a missing post preload even when home is correct', async () => {
  const result = await checkMedia(path => (path === '/' ? renderPreload(path) : '') + renderImage(path));
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /\/posts\/example: missing LCP image preload/);
});

test('rendered media checker rejects mismatched responsive preload candidates and sizes', async () => {
  for (const attribute of ['imagesrcset', 'imagesizes']) {
    const result = await checkMedia(path => renderPreload(path).replace(`${attribute}="`, `${attribute}="wrong `) + renderImage(path));
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /LCP preload (srcset differs|sizes differ)/);
  }
});
