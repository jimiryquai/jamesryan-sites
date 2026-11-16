import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { IMAGE_SLOTS } from '@jamesryan/cms-helpers';

// Replace only the CMS and Astro service boundaries; source selection and the
// shared responsive resolver run unchanged.
const emdash = await import('emdash');
let entries = [];
mock.module('emdash', { namedExports: {
  ...emdash,
  getEmDashCollection: async () => ({ entries, cacheHint: { tags: ['posts'] } }),
  getTermsForEntries: async () => new Map(),
} });
const transforms = [];
globalThis[Symbol.for('featured-preload-transforms')] = transforms;
const imageModule = `export async function getImage(options) {
  globalThis[Symbol.for('featured-preload-transforms')].push(options);
  return { src: '/_image?featured', srcSet: { attribute: '/_image?small 640w, /_image?featured 1200w' }, attributes: { sizes: options.sizes } };
}`;
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'astro:assets') return { url: `data:text/javascript,${encodeURIComponent(imageModule)}`, shortCircuit: true };
  return next(specifier, context);
} });
const { resolveFeaturedPostPreload } = await import('../src/components/page-builder/featured-post-preload.ts');
hook.deregister();
const layout = [{ _type: 'posts', _key: 'posts', _version: 1, variant: 'featured-grid' }];

function post(id, image) {
  return { id, data: { id, title: id, featured_image: image, content: [] } };
}

test('featured preload selects the first illustrated post and uses the shared responsive featured slot', async () => {
  transforms.length = 0;
  entries = [post('no-image'), post('featured', { id: 'cover', src: '/_emdash/api/media/file/cover.jpg' }), post('older', { id: 'older' })];
  const result = await resolveFeaturedPostPreload(layout, undefined, 'https://example.com');
  assert.deepEqual(result, {
    href: '/_image?featured', imagesrcset: '/_image?small 640w, /_image?featured 1200w',
    imagesizes: '(min-width: 1024px) 720px, calc(100vw - 3rem)',
  });
  assert.deepEqual(transforms, [{
    src: 'https://example.com/_emdash/api/media/file/cover.jpg',
    ...IMAGE_SLOTS.featuredPost, layout: 'constrained', fit: 'cover', position: 'center',
  }]);
});

test('featured preload omits missing and malformed media without requesting transforms', async () => {
  transforms.length = 0;
  entries = [post('no-image')];
  assert.equal(await resolveFeaturedPostPreload(layout, undefined, 'https://example.com'), undefined);
  entries = [post('empty-image', { id: '' })];
  assert.equal(await resolveFeaturedPostPreload(layout, undefined, 'https://example.com'), undefined);
  assert.equal(await resolveFeaturedPostPreload([], undefined, 'https://example.com'), undefined);
  assert.equal(transforms.length, 0);
});

test('about avatar declares intrinsic size, high priority, and async decoding', async () => {
  const source = await readFile(new URL('../src/pages/about.astro', import.meta.url), 'utf8');
  const avatar = source.match(/<img\b[^>]*src="\/images\/avatar\.webp"[\s\S]*?\/>/);
  assert.ok(avatar, 'about page is missing /images/avatar.webp');
  for (const attribute of ['width="500"', 'height="500"', 'fetchpriority="high"', 'decoding="async"']) {
    assert.ok(avatar[0].includes(attribute), attribute);
  }
});

test('image slots and responsive preload guards are wired across shared UI and both apps', async () => {
  const root = new URL('../../../', import.meta.url);
  const slots = [
    ['packages/ui/src/components/PostCard.astro', 'card'],
    ['packages/ui/src/components/ProjectCard.astro', 'card'],
    ['apps/marketing-site/src/components/page-builder/PostsFeaturedGrid.astro', 'featuredPost'],
    ['apps/marketing-site/src/pages/posts/index.astro', 'featuredPost'],
    ['apps/digital-garden/src/pages/index.astro', 'featuredPost'],
    ...['marketing-site', 'digital-garden'].flatMap(app => [
      [`apps/${app}/src/pages/posts/[slug].astro`, 'postHero'],
      [`apps/${app}/src/pages/projects/[slug].astro`, 'projectHero'],
    ]),
  ];
  for (const [path, slot] of slots) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.match(source, /import \{[^}]*IMAGE_SLOTS[^}]*\} from ["']@jamesryan\/cms-helpers["']/, path);
    assert.ok(source.includes(`<Image {...IMAGE_SLOTS.${slot}}`), `${path}: missing image slot`);
    if (source.includes("avatarMediaId")) assert.match(source, /<img data-byline-avatar\s+src=\{`\/_emdash\/api\/media\/file\/\$\{credit.byline.avatarMediaId\}`\}/, path);
  }
  const base = await readFile(new URL('packages/ui/src/components/Base.astro', root), 'utf8');
  assert.equal([...base.matchAll(/<link\b[^>]*rel="preload"[^>]*as="image"|<link\b[^>]*as="image"[^>]*rel="preload"/gs)].length, 1);
  assert.match(base, /preloadImage\?\.href/);
  assert.match(base, /href=\{preloadImage\.href\}/);
  assert.match(base, /imagesrcset=\{preloadImage\.imagesrcset\}/);
  assert.match(base, /imagesizes=\{preloadImage\.imagesizes\}/);
  assert.match(base, /fetchpriority="high"/);
  const heroRoutes = [
    'apps/marketing-site/src/pages/index.astro',
    'apps/marketing-site/src/pages/posts/index.astro',
    'apps/marketing-site/src/pages/posts/[slug].astro',
    'apps/marketing-site/src/pages/projects/[slug].astro',
    'apps/digital-garden/src/pages/index.astro',
    'apps/digital-garden/src/pages/posts/[slug].astro',
    'apps/digital-garden/src/pages/projects/[slug].astro',
  ];
  for (const path of heroRoutes) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.match(source, /preloadImage=\{/, path);
    assert.doesNotMatch(source, /rel="preload"/, path);
  }
  for (const [path, slot] of [
    ['apps/marketing-site/src/pages/posts/index.astro', 'featuredPost'],
    ['apps/marketing-site/src/pages/projects/[slug].astro', 'projectHero'],
    ['apps/digital-garden/src/pages/index.astro', 'featuredPost'],
    ['apps/digital-garden/src/pages/posts/[slug].astro', 'postHero'],
    ['apps/digital-garden/src/pages/projects/[slug].astro', 'projectHero'],
  ]) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.match(source, /resolveResponsiveImagePreload/, path);
    assert.match(source, /getPublicOrigin/, path);
    assert.match(source, new RegExp(`IMAGE_SLOTS\\.${slot}`), path);
  }
});
