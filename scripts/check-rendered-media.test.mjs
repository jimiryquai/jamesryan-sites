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

async function checkMedia(render, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'responsive-media-'));
  const seedPath = join(directory, 'seed.json');
  await writeFile(seedPath, JSON.stringify(options.seed ?? seed));
  const sitemap = options.sitemap ?? '<loc>https://example.com/</loc><loc>https://example.com/posts/example</loc>';
  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    if (url.startsWith('/_image?') || url.startsWith('/_emdash/api/media/file/') || url.startsWith('/images/')) {
      response.writeHead(200, { 'content-type': 'image/webp' });
      response.end('image bytes');
    } else if (url === '/sitemap.xml') {
      response.end(sitemap);
    } else {
      response.end(render(url.split('?')[0]));
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


test('rendered media checker loads raw byline avatars alongside responsive content', async () => {
  const result = await checkMedia(path => renderPreload(path) + renderImage(path) +
    '<img data-byline-avatar src="/_emdash/api/media/file/avatar" alt="Author" class="w-5 h-5 rounded-full object-cover">' +
    '<img data-byline-avatar src="/_emdash/api/media/file/avatar" alt="Author" class="w-10 h-10 rounded-full object-cover">');
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /6 loaded images, 2 responsive images, 2 matching preloads/);
});

test('rendered media checker rejects external Astro stylesheets and allows other stylesheets', async () => {
  const blocked = await checkMedia(path => renderPreload(path) + renderImage(path) + '<link rel="stylesheet" href="/_astro/route.css">');
  assert.equal(blocked.code, 1, blocked.output);
  assert.match(blocked.output, /external Astro stylesheet/);
  const allowed = await checkMedia(path => renderPreload(path) + renderImage(path) + '<link rel="stylesheet" href="https://fonts.example/a.css">');
  assert.equal(allowed.code, 0, allowed.output);
});

const archiveSeed = { content: {
  posts: [{ slug: 'example', status: 'published', data: { featured_image: { $media: { file: 'cover.webp', alt: 'Cover' } } } }],
  projects: [{ slug: 'fixture', status: 'published', data: { featured_image: { $media: { file: 'cover.webp', alt: 'Project' } } } }],
} };
const archiveSitemap = '<loc>https://example.com/posts</loc><loc>https://example.com/posts/example</loc><loc>https://example.com/projects/fixture</loc>';

function renderProject(priority = true, preload = true) {
  const sizes = '(min-width: 1280px) 1200px, calc(100vw - 3rem)';
  const image = `<img src="/_image?w=1280" width="1280" height="720" srcset="/_image?w=640 640w, /_image?w=1280 1280w" sizes="${sizes}" alt="Project" ${priority ? 'fetchpriority="high"' : ''}>`;
  const link = `<link rel="preload" as="image" href="/_image?w=1280" imagesrcset="/_image?w=640 640w, /_image?w=1280 1280w" imagesizes="${sizes}">`;
  return (preload ? link : '') + image;
}

function renderArchive(path, { postsPreload = true, projectPreload = true } = {}) {
  if (path === '/posts') return (postsPreload ? renderPreload('/') : '') + renderImage('/');
  if (path === '/projects/fixture') return renderProject(true, projectPreload);
  return renderPreload(path) + renderImage(path);
}

test('rendered media checker verifies posts index and project hero preloads', async () => {
  const result = await checkMedia(path => renderArchive(path), { seed: archiveSeed, sitemap: archiveSitemap });
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /3 responsive images, 3 matching preloads/);
});

test('rendered media checker rejects a missing posts index or project preload', async () => {
  for (const options of [{ postsPreload: false }, { projectPreload: false }]) {
    const result = await checkMedia(path => renderArchive(path, options), { seed: archiveSeed, sitemap: archiveSitemap });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /missing LCP image preload/);
  }
});

test('rendered media checker requires a featured preload on a garden home without a home page', async () => {
  const gardenSeed = { content: { posts: archiveSeed.content.posts } };
  const sitemap = '<loc>https://example.com/</loc><loc>https://example.com/posts/example</loc>';
  const missing = await checkMedia(path => (path === '/' ? '' : renderPreload(path)) + renderImage(path), { seed: gardenSeed, sitemap });
  assert.equal(missing.code, 1, missing.output);
  assert.match(missing.output, /\/: missing LCP image preload/);
  const present = await checkMedia(path => renderPreload(path) + renderImage(path), { seed: gardenSeed, sitemap });
  assert.equal(present.code, 0, present.output);
  const quiet = await checkMedia(() => '<p>No hero</p>', {
    seed: { content: { posts: [{ slug: 'example', status: 'published', data: { title: 'Plain' } }] } },
    sitemap: '<loc>https://example.com/</loc>',
  });
  assert.equal(quiet.code, 0, quiet.output);
});

test('rendered media checker requires about avatar priority and 500 by 500 dimensions', async () => {
  const aboutSeed = { content: { pages: [{ slug: 'about', status: 'published', data: { title: 'About' } }] } };
  const sitemap = '<loc>https://example.com/about</loc>';
  const missing = await checkMedia(() => '<img src="/images/avatar.webp" alt="James Ryan">', { seed: aboutSeed, sitemap });
  assert.equal(missing.code, 1, missing.output);
  assert.match(missing.output, /\/about: avatar/);
  const undecoded = await checkMedia(
    () => '<img src="/images/avatar.webp" alt="James Ryan" width="500" height="500" fetchpriority="high">',
    { seed: aboutSeed, sitemap },
  );
  assert.equal(undecoded.code, 1, undecoded.output);
  assert.match(undecoded.output, /\/about: avatar decoding/);
  const present = await checkMedia(
    () => '<img src="/images/avatar.webp" alt="James Ryan" width="500" height="500" fetchpriority="high" decoding="async">',
    { seed: aboutSeed, sitemap },
  );
  assert.equal(present.code, 0, present.output);
});

test('avatar exemption never hides unoptimized cards, EmDash images or seeded content', async () => {
  for (const attrs of [
    'alt="Unseeded card" width="800" height="500"',
    'data-byline-avatar alt="Unseeded EmDash" class="emdash-image-media"',
    'data-byline-avatar alt="Unseeded Astro" data-astro-image="constrained"',
    'data-byline-avatar alt="Cover" class="w-5 h-5 rounded-full object-cover"',
  ]) {
    const result = await checkMedia(path => renderPreload(path) + renderImage(path) +
      `<img src="/_emdash/api/media/file/unoptimized" ${attrs}>`);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /unoptimized CMS image/);
  }
});
