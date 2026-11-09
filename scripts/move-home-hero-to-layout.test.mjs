import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertHome } from './move-home-hero-to-layout.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/page-builder/home.json', import.meta.url)));

test('converts the seeded home hero without changing its copy, key or actions', () => {
  const original = structuredClone(fixture);
  const result = convertHome(fixture);
  assert.deepEqual(result, {
    content: [],
    layout: [{ _type: 'hero', _key: 'hero', _version: 1, variant: 'centered',
      heading: 'James Ryan — AI-native marketer & engineer',
      body: 'I build intelligent marketing engines and software tools that drive real growth. Bridging the gap between code and customers.',
      links: [{ label: 'View My Blog', url: '/posts' }, { label: 'About Me', url: '/about' }] }],
  });
  assert.deepEqual(fixture, original);
});

test('a converted home is idempotent and existing layouts are protected', () => {
  const migrated = convertHome(fixture);
  assert.equal(convertHome({ ...fixture, ...migrated }), null);
  assert.throws(() => convertHome({ ...fixture, layout: [{ _type: 'hero', _key: 'other', _version: 1 }] }), /already has a layout/);
  assert.throws(() => convertHome({ ...fixture, content: [...fixture.content, { _type: 'marketing.faq' }] }), /other blocks separately/);
});

test('non-centered and incomplete legacy heroes fail instead of losing content', () => {
  assert.throws(() => convertHome({ content: [{ ...fixture.content[0], centered: false }] }), /EmDash image/);
  assert.throws(() => convertHome({ content: [{ ...fixture.content[0], primaryCtaUrl: '' }] }), /Incomplete primaryCta/);
});

test('HTTP migration plans without writes, applies with _rev, and is safe to rerun', async () => {
  let data = structuredClone(fixture);
  let revision = 'revision-one';
  const writes = [];
  const http = async (url, options) => {
    assert.equal(new URL(url).origin, 'http://localhost:4999');
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body._rev, revision);
      writes.push(body);
      data = { ...data, ...body.data };
      revision = 'revision-two';
    }
    return Response.json({ success: true, data: { item: { id: 'home-id', slug: 'home', data }, _rev: revision } });
  };
  const { migrateHome } = await import('./move-home-hero-to-layout.mjs');
  const planned = await migrateHome({ site: 'http://localhost:4999', token: 'fake', http });
  assert.equal(planned.applied, false);
  assert.equal(writes.length, 0);
  const applied = await migrateHome({ site: 'http://localhost:4999', token: 'fake', http, apply: true });
  assert.equal(applied.applied, true);
  assert.equal(applied.revision, 'revision-two');
  assert.equal(writes[0]._rev, 'revision-one');
  assert.equal(writes[0].data.content.length, 0);
  assert.equal(writes[0].data.layout[0].heading, fixture.content[0].headline);
  const rerun = await migrateHome({ site: 'http://localhost:4999', token: 'fake', http, apply: true });
  assert.equal(rerun.action, 'unchanged');
  assert.equal(writes.length, 1);
});

test('HTTP errors and missing revisions stop writes and produce JSON failures', async () => {
  const { main } = await import('./move-home-hero-to-layout.mjs');
  const output = [];
  const http = async (_url, options) => {
    assert.equal(options.method, 'GET');
    return Response.json({ success: true, data: { item: { id: 'home-id', slug: 'home', data: fixture } } });
  };
  assert.equal(await main(['http://localhost:4999', '--apply'], { token: 'fake', http, out: (text) => output.push(JSON.parse(text)) }), 1);
  assert.match(output[0].errors[0].message, /no _rev/);
  const rejected = async () => Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
  assert.equal(await main(['http://localhost:4999'], { token: 'fake', http: rejected, out: (text) => output.push(JSON.parse(text)) }), 1);
  assert.equal(output[1].errors[0].code, 'CONFLICT');
});

test('non-local token requests require HTTPS before any HTTP call', async () => {
  const { main } = await import('./move-home-hero-to-layout.mjs');
  const output = [];
  const http = async () => { assert.fail('insecure destination must not receive a token'); };
  assert.equal(await main(['http://example.test'], { token: 'fake', http, out: (text) => output.push(JSON.parse(text)) }), 1);
  assert.match(output[0].errors[0].message, /HTTPS/);
});

test('the table view describes the same planned migration without writes', async () => {
  const { main } = await import('./move-home-hero-to-layout.mjs');
  const output = [];
  const http = async (_url, options) => {
    assert.equal(options.method, 'GET');
    return Response.json({ success: true, data: { item: { id: 'home-id', slug: 'home', data: fixture }, _rev: 'one' } });
  };
  assert.equal(await main(['http://localhost', '--table'], { token: 'fake', http, out: (text) => output.push(text) }), 0);
  assert.match(output[0], /move-hero-to-layout/);
  assert.match(output[0], /applied\s+false/);
  assert.match(output[0], /View My Blog/);
});
