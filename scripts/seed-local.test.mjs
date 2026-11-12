import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const run = promisify(execFile);

test('emdash seed imports committed local files as media with original bytes and per-use alt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'seed-media-'));
  try {
    await mkdir(join(directory, 'assets'));
    const original = resolve('apps/marketing-site/seed/assets/enable-static-result.png');
    await copyFile(original, join(directory, 'assets/step.png'));
    const seed = {
      version: '1', collections: [{ slug: 'posts', label: 'Posts', fields: [
        { slug: 'title', label: 'Title', type: 'string' },
        { slug: 'featured_image', label: 'Image', type: 'image' },
        { slug: 'content', label: 'Content', type: 'portableText' },
      ] }],
      content: { posts: [{ id: 'post', slug: 'post', status: 'published', data: {
        title: 'Test post', content: [{ _type: 'image', _key: 'step', alt: 'Screenshot alt', caption: 'Screenshot caption',
          asset: { $media: { file: 'assets/step.png', alt: 'Screenshot alt', caption: 'Screenshot caption' } } }], featured_image: { $media: { file: 'assets/step.png', alt: 'James’s exact alt', caption: 'Exact caption' } },
      } }] },
    };
    const seedPath = join(directory, 'seed.json');
    await writeFile(seedPath, JSON.stringify(seed));
    const database = join(directory, 'data.db');
    const uploads = join(directory, 'uploads');
    const { stdout } = await run(process.execPath, [resolve('apps/marketing-site/node_modules/emdash/dist/cli/index.mjs'),
      'seed', seedPath, '--database', database, '--uploads-dir', uploads]);
    assert.match(stdout, /Media: 1 created, 1 skipped/);
    const db = new DatabaseSync(database);
    try {
      const media = db.prepare('SELECT * FROM media').get();
      assert.equal(media.alt, 'Screenshot alt');
      assert.equal(media.caption, 'Screenshot caption');
      assert.ok(media.width > 0 && media.height > 0);
      assert.deepEqual(await readFile(join(uploads, media.storage_key)), await readFile(original));
      const image = JSON.parse(db.prepare('SELECT featured_image FROM ec_posts').get().featured_image);
      assert.equal(image.id, media.id);
      assert.equal(image.alt, 'James’s exact alt');
      assert.equal(image.caption, 'Exact caption');
      const [block] = JSON.parse(db.prepare('SELECT content FROM ec_posts').get().content);
      assert.equal(block.asset._ref, media.id);
      assert.equal(block.alt, 'Screenshot alt');
      assert.equal(block.caption, 'Screenshot caption');
    } finally { db.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('emdash seed refuses files and symlinks outside the seed directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'seed-media-path-'));
  try {
    const seedDirectory = join(directory, 'seed');
    await mkdir(seedDirectory);
    await copyFile(resolve('apps/marketing-site/seed/assets/post-1.webp'), join(directory, 'outside.webp'));
    await symlink(join(directory, 'outside.webp'), join(seedDirectory, 'escape.webp'));
    for (const [index, file] of ['../outside.webp', 'escape.webp', join(directory, 'outside.webp')].entries()) {
      const seed = { version: '1', collections: [{ slug: 'posts', label: 'Posts', fields: [
        { slug: 'image', label: 'Image', type: 'image' },
      ] }], content: { posts: [{ id: 'post', slug: 'post', data: { image: { $media: { file } } } }] } };
      const seedPath = join(seedDirectory, 'seed.json');
      await writeFile(seedPath, JSON.stringify(seed));
      const database = join(directory, `${index}.db`);
      const { stdout, stderr } = await run(process.execPath, [resolve('apps/marketing-site/node_modules/emdash/dist/cli/index.mjs'),
        'seed', seedPath, '--database', database, '--uploads-dir', join(directory, 'uploads')]);
      assert.match(stdout, /Media: 0 created, 1 skipped/);
      assert.match(stderr, /escapes the seed directory|must be relative|must remain within mediaBasePath/);
      const db = new DatabaseSync(database);
      try { assert.equal(db.prepare('SELECT count(*) AS total FROM media').get().total, 0); }
      finally { db.close(); }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
