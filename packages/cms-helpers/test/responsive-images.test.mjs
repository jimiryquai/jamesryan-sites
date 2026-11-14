import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IMAGE_SLOTS, resolveResponsiveImagePreload } from '../src/responsive-images.ts';

test('local media preload matches the constrained image transform and responsive attributes', async () => {
  const preload = await resolveResponsiveImagePreload(async (options) => {
    assert.deepEqual(options, {
      src: 'https://example.com/_emdash/api/media/file/cover.jpg',
      width: 1200, height: 750,
      sizes: '(min-width: 1024px) 720px, calc(100vw - 3rem)',
      layout: 'constrained', fit: 'cover', position: 'center',
    });
    return { src: '/_image?w=1200', srcSet: { attribute: '/_image?w=640 640w, /_image?w=1200 1200w' }, attributes: { sizes: 'rendered sizes' } };
  }, { id: 'cover', meta: { storageKey: 'cover.jpg' } }, { origin: 'https://example.com', ...IMAGE_SLOTS.featuredPost });
  assert.deepEqual(preload, {
    href: '/_image?w=1200', imagesrcset: '/_image?w=640 640w, /_image?w=1200 1200w', imagesizes: 'rendered sizes',
  });
});

test('external providers without a source retain the raw fallback without local transforms', async () => {
  let transforms = 0;
  const result = await resolveResponsiveImagePreload(async () => {
    transforms++;
    return { src: '/_image?external' };
  },
    { id: 'external', provider: 'cloudflare-images' }, { origin: 'https://example.com', ...IMAGE_SLOTS.postHero });
  assert.equal(transforms, 0);
  assert.deepEqual(result, { href: '/_emdash/api/media/file/external' });
});

test('slot presets describe card, featured and hero display sizes', () => {
  assert.deepEqual(IMAGE_SLOTS, {
    card: { width: 800, height: 500, sizes: '(min-width: 1024px) 384px, (min-width: 640px) 50vw, calc(100vw - 3rem)' },
    featuredPost: { width: 1200, height: 750, sizes: '(min-width: 1024px) 720px, calc(100vw - 3rem)' },
    postHero: { width: 1200, height: 750, sizes: '(min-width: 1280px) 1200px, calc(100vw - 3rem)' },
    projectHero: { width: 1280, height: 720, sizes: '(min-width: 1280px) 1200px, calc(100vw - 3rem)' },
  });
});

test('same-origin absolute URLs and media dimensions work without slot overrides', async () => {
  let received;
  const result = await resolveResponsiveImagePreload(async (options) => {
    received = options;
    return { src: '/_image?small', srcSet: { attribute: '/_image?small 320w' } };
  }, { src: 'https://example.com/cover.jpg', width: 320, height: 200 }, { origin: 'https://example.com', sizes: '100vw' });
  assert.equal(received.src, 'https://example.com/cover.jpg');
  assert.equal(received.width, 320);
  assert.equal(received.height, 200);
  assert.deepEqual(result, { href: '/_image?small', imagesrcset: '/_image?small 320w', imagesizes: '100vw' });
});

test('escaped, cross-origin and protocol-relative sources do not reach the optimizer', async () => {
  for (const src of ['//evil.example/a.jpg', '//example.com/a.jpg', '/\\evil.example/a.jpg', 'https://evil.example/a.jpg', 'data:image/png;base64,abc']) {
    let transforms = 0;
    const result = await resolveResponsiveImagePreload(async () => {
      transforms++;
      return { src: '/_image?unexpected' };
    }, src, { origin: 'https://example.com', ...IMAGE_SLOTS.postHero });
    assert.equal(transforms, 0, src);
    assert.deepEqual(result, { href: src });
  }
});

test('missing dimensions, invalid origin, optimizer errors and passthrough omit responsive preload hints', async () => {
  const src = '/_emdash/api/media/file/cover.jpg';
  const options = { origin: 'https://example.com', ...IMAGE_SLOTS.postHero };
  for (const getImage of [async () => { throw new Error('unavailable'); }, async ({ src }) => ({ src })]) {
    assert.deepEqual(await resolveResponsiveImagePreload(getImage, { src }, options), { href: src });
  }
  let transforms = 0;
  const optimizer = async () => { transforms++; return { src: '/_image?unexpected' }; };
  assert.deepEqual(await resolveResponsiveImagePreload(optimizer, { src }, { origin: 'https://example.com', sizes: '100vw' }), { href: src });
  assert.deepEqual(await resolveResponsiveImagePreload(optimizer, { src }, { ...options, origin: 'bad origin' }), { href: src });
  assert.equal(transforms, 0);
});

test('relative public assets retain their source like the EmDash component', async () => {
  let transforms = 0;
  const result = await resolveResponsiveImagePreload(async () => {
    transforms++;
    return { src: '/_image?unexpected' };
  }, 'cover.jpg', { origin: 'https://example.com', ...IMAGE_SLOTS.featuredPost });
  assert.equal(transforms, 0);
  assert.deepEqual(result, { href: 'cover.jpg' });
});
