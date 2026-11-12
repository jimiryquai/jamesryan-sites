import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addHomePostsBlock, planHomePostsBlock, HOME_POSTS_BLOCK } from './add-home-posts-block.mjs';

const hero = { _type: 'hero', _key: 'hero', _version: 1, variant: 'centered', heading: 'Hi' };

/**
 * A fake live site serving only the pages content API, modelling EmDash's GET
 * hydration: a published page with a pending draft serves the draft in
 * `item.data` and the published columns in `item.liveData`. A PUT on a
 * published page stages a draft; publish promotes it.
 */
function fakeSite({ home, pending, concurrentEdit } = {}) {
  const item = {
    id: 'home-id', slug: 'home', status: 'published', draftRevisionId: null,
    data: structuredClone(home ?? { title: 'Home', layout: [hero] }),
  };
  if (pending) {
    item.data = structuredClone(pending.draft);
    item.draftData = structuredClone(pending.draft);
    item.liveData = structuredClone(pending.live);
    item.draftRevisionId = 'rev-pending';
  }
  const revisions = new Map([[item.id, pending ? 'rev-pending' : 'rev-home-1']]);
  const store = new Map([[item.id, item]]);
  const calls = [];
  let wrote = false;
  const http = async (url, options = {}) => {
    const { pathname } = new URL(url);
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, path: pathname, ...(body ? { body } : {}) });
    const reply = (data, status = 200) => Response.json({ success: true, data }, { status });
    if (method === 'GET' && (pathname === '/_emdash/api/content/pages/home' || pathname === '/_emdash/api/content/pages/home-id')) {
      const stored = store.get('home-id');
      if (stored.draftRevisionId) {
        if (concurrentEdit && wrote) concurrentEdit(stored);
        return reply({
          item: {
            id: stored.id, slug: stored.slug, status: stored.status, draftRevisionId: stored.draftRevisionId,
            data: structuredClone(stored.draftData), liveData: structuredClone(stored.liveData),
          },
          _rev: revisions.get('home-id'),
        });
      }
      return reply({
        item: { id: stored.id, slug: stored.slug, status: stored.status, draftRevisionId: null, data: structuredClone(stored.data) },
        _rev: revisions.get('home-id'),
      });
    }
    if (method === 'PUT' && pathname === '/_emdash/api/content/pages/home-id') {
      const stored = store.get('home-id');
      if (body._rev !== revisions.get('home-id')) {
        return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
      }
      if (stored.status === 'published') {
        stored.liveData = structuredClone(stored.draftRevisionId ? stored.liveData : stored.data);
        stored.draftData = structuredClone(body.data);
        stored.draftRevisionId = 'rev-home-2';
      } else {
        stored.data = structuredClone(body.data);
      }
      revisions.set('home-id', 'rev-home-2');
      wrote = true;
      return reply({ item: structuredClone(stored) });
    }
    if (method === 'POST' && pathname === '/_emdash/api/content/pages/home-id/publish') {
      const stored = store.get('home-id');
      if (body._rev !== revisions.get('home-id')) {
        return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Revision changed' } }, { status: 409 });
      }
      if (!stored.draftRevisionId) {
        return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Nothing staged' } }, { status: 409 });
      }
      stored.data = structuredClone(stored.draftData);
      stored.draftData = undefined;
      stored.liveData = undefined;
      stored.draftRevisionId = null;
      return reply({ item: structuredClone(stored), _rev: revisions.get('home-id') });
    }
    return Response.json({ success: false, error: { code: 'NOT_FOUND', message: `no route ${method} ${pathname}` } }, { status: 404 });
  };
  return { store, calls, http };
}

const liveHome = () => ({ title: 'Home', layout: [hero] });

test('plans the posts block immediately after the hero, before the blocks that follow it', () => {
  const cta = { _type: 'cta', _key: 'cta', _version: 1 };
  const plan = planHomePostsBlock({ layout: [hero, cta] });
  assert.equal(plan.action, 'add-home-posts-block');
  assert.deepEqual(plan.layout, [hero, HOME_POSTS_BLOCK, cta]);
});

test('plans the posts block at the end when home has no hero, and on an empty layout', () => {
  const cta = { _type: 'cta', _key: 'cta', _version: 1 };
  assert.deepEqual(planHomePostsBlock({ layout: [cta] }).layout, [cta, HOME_POSTS_BLOCK]);
  assert.deepEqual(planHomePostsBlock({}).layout, [HOME_POSTS_BLOCK]);
});

test('a home that already has a posts block plans nothing, whatever its variant', () => {
  assert.equal(planHomePostsBlock({ layout: [hero, HOME_POSTS_BLOCK] }).action, 'unchanged');
  assert.equal(planHomePostsBlock({ layout: [{ _type: 'posts', _key: 'p', _version: 1, variant: 'list' }] }).action, 'unchanged');
});

test('a foreign block holding the posts key stops the plan instead of colliding', () => {
  const plan = planHomePostsBlock({ layout: [hero, { _type: 'cta', _key: 'posts', _version: 1 }] });
  assert.equal(plan.action, 'stopped');
  assert.match(plan.stopReason[0], /cta.*'posts'/);
});

test('plans against the live home and writes nothing by default', async () => {
  const site = fakeSite();
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', http: site.http });
  assert.equal(result.page.action, 'add-home-posts-block');
  assert.equal(result.page.applied, false);
  assert.equal(result.applied, false);
  assert.equal(result.blocked, false);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, 0);
  assert.deepEqual(result.page.moves, [{ after: 'hero', to: 'posts', key: 'posts' }]);
});

test('applies with _rev, republishes the published home, and verifies the write', async () => {
  const site = fakeSite();
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.applied, true);
  assert.equal(result.page.applied, true);
  assert.equal(result.page.published, true);
  const put = site.calls.find((call) => call.method === 'PUT');
  assert.equal(put.path, '/_emdash/api/content/pages/home-id');
  assert.equal(put.body._rev, 'rev-home-1');
  assert.deepEqual(put.body.data.layout.map((block) => block._type), ['hero', 'posts']);
  assert.deepEqual(put.body.data.layout[1], HOME_POSTS_BLOCK);
  assert.equal(put.body.data.title, 'Home');
  const publish = site.calls.find((call) => call.method === 'POST');
  assert.equal(publish.body._rev, 'rev-home-2');
  const stored = site.store.get('home-id');
  assert.equal(stored.status, 'published');
  assert.equal(stored.draftRevisionId, null);
  assert.deepEqual(stored.data.layout.map((block) => block._type), ['hero', 'posts']);
});

test('a draft home is written but not published', async () => {
  const site = fakeSite({ home: liveHome() });
  site.store.get('home-id').status = 'draft';
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.page.published, undefined);
  assert.equal(site.calls.filter((call) => call.method === 'POST').length, 0);
  assert.equal(result.page.applied, true);
});

test('a second apply run changes nothing', async () => {
  const site = fakeSite();
  await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  const writes = site.calls.filter((call) => call.method !== 'GET').length;
  const rerun = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(rerun.page.action, 'unchanged');
  assert.equal(rerun.applied, false);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, writes);
});

test('an unrelated pending draft on a published home refuses to write or publish, failing --apply and passing plan', async () => {
  const site = fakeSite({
    pending: { live: liveHome(), draft: { title: 'Home (edited)', layout: [hero, HOME_POSTS_BLOCK] } },
  });
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.blocked, true);
  assert.equal(result.page.action, 'pending-draft');
  assert.equal(result.page.applied, false);
  assert.match(result.page.error.message, /not a verified home posts migration/);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, 0, 'a blocked run must not write');
  const { main } = await import('./add-home-posts-block.mjs');
  const outputs = [];
  const applied = await main(['http://localhost:4999', '--apply'], { token: 'fake', http: site.http, out: (text) => outputs.push(text) });
  assert.equal(applied, 1);
  assert.equal(JSON.parse(outputs[0]).page.action, 'pending-draft');
  const planned = await main(['http://localhost:4999'], { token: 'fake', http: site.http, out: (text) => outputs.push(text) });
  assert.equal(planned, 0, 'plan mode exits 0 whatever it finds');
});

test('a pending draft with no live data to compare refuses the same way', async () => {
  const site = fakeSite({ pending: { live: liveHome(), draft: { ...liveHome(), layout: [hero, HOME_POSTS_BLOCK] } } });
  const noLive = async (url, options = {}) => {
    const response = await site.http(url, options);
    if ((options.method ?? 'GET') === 'GET' && new URL(url).pathname.includes('/pages/')) {
      const body = await response.json();
      if (body.data?.item?.liveData) delete body.data.item.liveData;
      return Response.json(body);
    }
    return response;
  };
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: noLive });
  assert.equal(result.blocked, true);
  assert.match(result.page.error.message, /no live data to compare/);
});

test('a verified pending migration draft republishes without a redundant PUT', async () => {
  const site = fakeSite({
    pending: { live: liveHome(), draft: { ...liveHome(), layout: [hero, HOME_POSTS_BLOCK] } },
  });
  const plan = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', http: site.http });
  assert.equal(plan.page.action, 'republish-home-posts-block');
  assert.equal(plan.page.applied, false);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, 0, 'planning must not write');

  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.page.action, 'republish-home-posts-block');
  assert.equal(result.page.applied, true);
  assert.equal(result.page.published, true);
  assert.equal(site.calls.filter((call) => call.method === 'PUT').length, 0, 'the draft is already staged; no redundant PUT');
  const publish = site.calls.find((call) => call.method === 'POST');
  assert.equal(publish.path, '/_emdash/api/content/pages/home-id/publish');
  assert.equal(publish.body._rev, 'rev-pending');
  const stored = site.store.get('home-id');
  assert.equal(stored.status, 'published');
  assert.equal(stored.draftRevisionId, null);
  assert.deepEqual(stored.data.layout.map((block) => block._type), ['hero', 'posts']);
});

test('a concurrent edit between the PUT and its read-back aborts before publishing', async () => {
  const site = fakeSite({
    concurrentEdit: (stored) => { stored.draftData.title = 'Home (someone else)'; },
  });
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.page.applied, false);
  assert.match(result.page.error.message, /changed between the write and its read-back/);
  assert.equal(site.calls.filter((call) => call.method === 'POST').length, 0, 'an unverified draft must never be published');
});

test('a home response without _rev refuses an unguarded write', async () => {
  const noRev = async () => Response.json({ success: true, data: { item: { id: 'home-id', slug: 'home', status: 'draft', data: liveHome() } } });
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: noRev });
  assert.equal(result.applied, false);
  assert.match(result.page.error.message, /no _rev/);
});

test('write failures shape the wire error and fail the run', async () => {
  const site = fakeSite();
  const failing = async (url, options = {}) => {
    if ((options.method ?? 'GET') === 'PUT') {
      return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
    }
    return site.http(url, options);
  };
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: failing });
  assert.equal(result.applied, false);
  assert.equal(result.page.error.code, 'CONFLICT');
});

test('main prints JSON by default, a table with --table, and guards the destination', async () => {
  const { main } = await import('./add-home-posts-block.mjs');
  const site = fakeSite();
  const outputs = [];
  const json = await main(['http://localhost:4999'], { token: 'fake', http: site.http, out: (text) => outputs.push(text) });
  assert.equal(json, 0);
  assert.equal(JSON.parse(outputs[0]).page.action, 'add-home-posts-block');
  const table = await main(['http://localhost:4999', '--table'], { token: 'fake', http: site.http, out: (text) => outputs.push(text) });
  assert.equal(table, 0);
  assert.match(outputs[1], /add-home-posts-block/);
  const insecure = await main(['http://example.test'], { token: 'fake', http: async () => assert.fail('must not call out'), out: (text) => outputs.push(text) });
  assert.equal(insecure, 1);
  assert.match(outputs[2], /HTTPS/);
});
