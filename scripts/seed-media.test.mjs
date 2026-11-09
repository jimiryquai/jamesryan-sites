import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteSeedMedia } from './seed-media.mjs';

test('stored media becomes a local file reference with original alt text and captions', () => {
  const seed = { content: { posts: [{ data: { featured_image: {
    provider: 'local', id: 'old-id', src: '/_emdash/api/media/file/stale.webp',
    alt: 'James’s exact alt text', caption: '',
  } } }] } };
  const { seed: rewritten, downloads } = rewriteSeedMedia(seed, [{
    id: 'old-id', filename: 'workspace.jpg', storage_key: 'actual.jpg',
    alt: 'Library alt', caption: 'Library caption',
  }]);
  assert.deepEqual(rewritten.content.posts[0].data.featured_image, { $media: {
    file: 'assets/workspace.jpg', alt: 'James’s exact alt text', caption: '', libraryCaption: 'Library caption',
  } });
  assert.deepEqual(downloads, [{ file: 'assets/workspace.jpg', url: '/_emdash/api/media/file/actual.jpg' }]);
  assert.equal(seed.content.posts[0].data.featured_image.id, 'old-id');
});

test('Portable Text and repeater images keep per-use copy and rewriting is rerunnable', () => {
  const source = { content: { pages: [{ data: {
    content: [{ _type: 'image', _key: 'step', asset: { _ref: 'old', url: '/images/step.png' },
      alt: 'Exact screenshot alt', caption: 'Original caption' }],
    gallery: [{ image: { $media: { url: '/images/detail.png', alt: 'Detail alt' } } }],
  } }] } };
  const result = rewriteSeedMedia(source, []);
  assert.deepEqual(result.seed.content.pages[0].data, {
    content: [{ _type: 'image', _key: 'step', asset: { $media: {
      file: 'assets/step.png', alt: 'Exact screenshot alt', caption: 'Original caption',
    } }, alt: 'Exact screenshot alt', caption: 'Original caption' }],
    gallery: [{ image: { $media: { file: 'assets/detail.png', alt: 'Detail alt' } } }],
  });
  assert.deepEqual(rewriteSeedMedia(result.seed, []), { seed: result.seed, downloads: [] });
});

test('marketing seed resolves every image to a bundled asset without stored library IDs', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const base = new URL('../apps/marketing-site/seed/', import.meta.url);
  const seed = JSON.parse(await readFile(new URL('seed.json', base), 'utf8'));
  const files = new Set();
  async function verify(value) {
    if (!value || typeof value !== 'object') return;
    assert.notEqual(value.provider, 'local', 'seed contains a stored media value');
    if (value._type === 'image') assert.ok(value.asset.$media?.file, 'Portable Text image is not portable');
    if (value.$media) {
      assert.match(value.$media.file, /^assets\/[^/]+$/);
      assert.equal(value.$media.url, undefined);
      await access(new URL(value.$media.file, base));
      files.add(value.$media.file);
    }
    await Promise.all(Object.values(value).map(verify));
  }
  await verify(seed);
  assert.ok(files.size > 0, 'seed has no bundled media');
});

test('repairing a mixed export refuses to overwrite an existing local asset', () => {
  assert.throws(() => rewriteSeedMedia({ content: [
    { $media: { url: '/images/step.png', alt: 'New image' } },
    { $media: { file: 'assets/step.png', alt: 'Existing image' } },
  ] }, []), /already referenced/);
});
