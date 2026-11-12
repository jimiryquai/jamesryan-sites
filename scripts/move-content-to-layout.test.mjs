import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertBlock } from './move-content-to-layout.mjs';

const homeFixture = JSON.parse(readFileSync(new URL('./fixtures/page-builder/home.json', import.meta.url)));
const privacyFixture = JSON.parse(readFileSync(new URL('./fixtures/page-builder/privacy-policy.json', import.meta.url)));

test('maps the seeded home hero to a centered page-builder hero', () => {
  const result = convertBlock(homeFixture.content[0]);
  assert.deepEqual(result, {
    block: {
      _type: 'hero', _key: 'hero', _version: 1, variant: 'centered',
      heading: 'James Ryan — AI-native marketer & engineer',
      body: 'I build intelligent marketing engines and software tools that drive real growth. Bridging the gap between code and customers.',
      links: [{ label: 'View My Blog', url: '/posts' }, { label: 'About Me', url: '/about' }],
    },
    skipped: [{ block: 'hero', field: 'variation', reason: 'not rendered when centered' }],
  });
});

test('carries the eyebrow announcement onto the hero', () => {
  const result = convertBlock({
    ...homeFixture.content[0],
    eyebrowText: 'New', eyebrowUrl: '/new', eyebrowCta: 'Read',
  });
  assert.equal(result.block.eyebrow, 'New');
  assert.equal(result.block.eyebrow_url, '/new');
  assert.equal(result.block.eyebrow_action, 'Read');
});

test('stops non-centered heroes instead of losing their artwork or plans', () => {
  assert.match(convertBlock({ ...homeFixture.content[0], centered: false }).stop, /photo|demo/i);
  assert.match(convertBlock({ ...homeFixture.content[0], centered: false, variation: 'left-aligned-with-photo', photoUrl: '/me.jpg' }).stop, /EmDash media/);
  const pricingHero = { ...homeFixture.content[0], centered: false, variation: 'pricing-hero-multi-tier', plans: [{ name: 'Pro' }] };
  assert.match(convertBlock(pricingHero).stop, /pricing/);
});

test('stops a hero without a key, headline, or with an incomplete CTA', () => {
  const { _key, ...noKey } = homeFixture.content[0];
  assert.match(convertBlock(noKey).stop, /key/);
  assert.match(convertBlock({ ...homeFixture.content[0], headline: ' ' }).stop, /headline/);
  assert.match(convertBlock({ ...homeFixture.content[0], primaryCtaUrl: '' }).stop, /Incomplete primaryCta/);
});

test('maps marketing.cta to a cta block, aligning both variations', () => {
  const shape = {
    _type: 'marketing.cta', _key: 'cta1', variation: 'left-aligned', headline: 'Start today',
    subheadline: 'Get going in minutes', primaryCtaLabel: 'Start', primaryCtaUrl: '/start',
    secondaryCtaLabel: 'Docs', secondaryCtaUrl: '/docs',
  };
  assert.deepEqual(convertBlock(shape), {
    block: {
      _type: 'cta', _key: 'cta1', _version: 1, variant: 'start', heading: 'Start today',
      body: 'Get going in minutes', links: [{ label: 'Start', url: '/start' }, { label: 'Docs', url: '/docs' }],
    },
  });
  assert.equal(convertBlock({ ...shape, variation: 'centered' }).block.variant, 'centered');
  assert.equal(convertBlock({ ...shape, variation: undefined }).block.variant, 'start');
  assert.match(convertBlock({ ...shape, variation: 'sideways' }).stop, /variation/);
});

test('maps marketing.features to a two-column features block', () => {
  const shape = {
    _type: 'marketing.features', _key: 'f1', headline: 'Everything you need', subheadline: 'All of it',
    features: [{ icon: 'zap', title: 'Fast', description: 'Quickly does things' }, { title: 'Simple' }],
  };
  assert.deepEqual(convertBlock(shape), {
    block: {
      _type: 'features', _key: 'f1', _version: 1, variant: 'two-column', heading: 'Everything you need',
      subheadline: 'All of it',
      items: [{ title: 'Fast', description: 'Quickly does things', icon: 'zap' }, { title: 'Simple' }],
    },
  });
  assert.match(convertBlock({ ...shape, features: [] }).stop, /at least one/);
  assert.match(convertBlock({ ...shape, headline: '' }).stop, /heading/);
  assert.match(convertBlock({ ...shape, features: [{ icon: 'zap' }] }).stop, /title/);
});

test('maps marketing.stats to a graph stats block with value/label items', () => {
  const shape = {
    _type: 'marketing.stats', _key: 's1', eyebrow: 'By the numbers', headline: 'Growth',
    subheadline: 'Going up', stats: [{ stat: '99%', text: 'Uptime' }, { stat: '2x', text: 'Speed' }],
  };
  assert.deepEqual(convertBlock(shape), {
    block: {
      _type: 'stats', _key: 's1', _version: 1, variant: 'graph', eyebrow: 'By the numbers',
      heading: 'Growth', body: 'Going up', items: [{ value: '99%', label: 'Uptime' }, { value: '2x', label: 'Speed' }],
    },
  });
  assert.match(convertBlock({ ...shape, stats: [] }).stop, /at least one/);
});

test('maps marketing.comparison to fixed columns and ordered rows', () => {
  const shape = {
    _type: 'marketing.comparison', _key: 'c1',
    items: [{ groupName: 'Collaboration', name: 'Private notes', starterValue: 'true', growthValue: 'false', proValue: 'Unlimited' }],
  };
  assert.deepEqual(convertBlock(shape), {
    block: {
      _type: 'comparison', _key: 'c1', _version: 1, variant: 'table',
      columns: [
        { key: 'first', label: 'Starter' }, { key: 'second', label: 'Growth' }, { key: 'third', label: 'Pro' },
      ],
      rows: [{ group_name: 'Collaboration', name: 'Private notes', first_value: 'true', second_value: 'false', third_value: 'Unlimited' }],
    },
  });
  assert.match(convertBlock({ ...shape, items: [] }).stop, /at least one/);
  assert.match(convertBlock({ ...shape, items: [{ groupName: 'G', starterValue: '1' }] }).stop, /name/);
});

test('maps service-driven shared-content blocks to scoped blocks', () => {
  assert.deepEqual(convertBlock({ _type: 'marketing.testimonials', _key: 't1', serviceSlug: 'consulting' }), {
    block: { _type: 'testimonials', _key: 't1', _version: 1, variant: 'grid', scope: 'page' },
    service: 'consulting',
  });
  assert.deepEqual(convertBlock({ _type: 'marketing.pricing', _key: 'p1', serviceSlug: 'consulting' }), {
    block: { _type: 'pricing', _key: 'p1', _version: 1, variant: 'tiers', scope: 'page' },
    service: 'consulting',
  });
  assert.deepEqual(convertBlock({ _type: 'marketing.faq', _key: 'q1', variation: 'centered', serviceSlug: 'consulting' }), {
    block: { _type: 'faq', _key: 'q1', _version: 1, variant: 'centered', scope: 'page' },
    service: 'consulting',
  });
  assert.equal(convertBlock({ _type: 'marketing.faq', _key: 'q1', serviceSlug: 's' }).block.variant, 'two-column');
  assert.deepEqual(convertBlock({ _type: 'marketing.team', _key: 'm1', serviceSlug: 'consulting' }), {
    block: { _type: 'team', _key: 'm1', _version: 1, variant: 'four-column', scope: 'page' },
    service: 'consulting',
  });
});

test('stops shared-content blocks whose inline data or headings have no target field', () => {
  const inline = {
    'marketing.testimonials': { testimonials: [{ quote: 'Great', author: 'Ann' }] },
    'marketing.pricing': { plans: [{ name: 'Pro', price: '$29' }] },
    'marketing.faq': { items: [{ question: 'Q?', answer: 'A.' }] },
    'marketing.team': { members: [{ name: 'Ann', byline: 'Founder', img: '/ann.jpg' }] },
  };
  for (const [type, data] of Object.entries(inline)) {
    assert.match(convertBlock({ _type: type, _key: 'x1', ...data }).stop, new RegExp(type.split('.')[1]));
  }
  assert.match(convertBlock({ _type: 'marketing.pricing', _key: 'p1', headline: 'Pricing', serviceSlug: 's' }).stop, /heading/);
  assert.match(convertBlock({ _type: 'marketing.faq', _key: 'q1', headline: 'Q', subheadline: 'A', serviceSlug: 's' }).stop, /heading/);
  assert.match(convertBlock({ _type: 'marketing.team', _key: 'm1', headline: 'Us', serviceSlug: 's' }).stop, /heading/);
  assert.match(convertBlock({ _type: 'marketing.testimonials', _key: 't1' }).stop, /service/);
  assert.match(convertBlock({ _type: 'marketing.testimonials', _key: 't1', headline: 'Kind words', serviceSlug: 's' }).stop, /heading/);
});

test('converts the subset of HTML the editor writes to Portable Text', async () => {
  const { htmlToPortableText } = await import('./move-content-to-layout.mjs');
  const html = '<p>Hello <strong>world</strong> and <em>you</em> <code>now()</code></p>'
    + '<h2>Titles</h2><ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>'
    + '<p>A<br />B <a href="https://x.test">link</a></p><blockquote>Quoted</blockquote>'
    + '<p>Plain <b>bold</b> <i>italic</i> text</p>';
  const blocks = htmlToPortableText(html, 'doc1');
  assert.deepEqual(blocks, [
    { _type: 'block', _key: 'doc1-0', style: 'normal', children: [
      { _type: 'span', _key: 'doc1-0-0', text: 'Hello ', marks: [] },
      { _type: 'span', _key: 'doc1-0-1', text: 'world', marks: ['strong'] },
      { _type: 'span', _key: 'doc1-0-2', text: ' and ', marks: [] },
      { _type: 'span', _key: 'doc1-0-3', text: 'you', marks: ['em'] },
      { _type: 'span', _key: 'doc1-0-4', text: ' ', marks: [] },
      { _type: 'span', _key: 'doc1-0-5', text: 'now()', marks: ['code'] },
    ] },
    { _type: 'block', _key: 'doc1-1', style: 'h2', children: [
      { _type: 'span', _key: 'doc1-1-0', text: 'Titles', marks: [] },
    ] },
    { _type: 'block', _key: 'doc1-2', style: 'normal', listItem: 'bullet', level: 1, children: [
      { _type: 'span', _key: 'doc1-2-0', text: 'One', marks: [] },
    ] },
    { _type: 'block', _key: 'doc1-3', style: 'normal', listItem: 'bullet', level: 1, children: [
      { _type: 'span', _key: 'doc1-3-0', text: 'Two', marks: [] },
    ] },
    { _type: 'block', _key: 'doc1-4', style: 'normal', listItem: 'number', level: 1, listId: 'doc1-ol-0', children: [
      { _type: 'span', _key: 'doc1-4-0', text: 'First', marks: [] },
    ] },
    { _type: 'block', _key: 'doc1-5', style: 'normal', children: [
      { _type: 'span', _key: 'doc1-5-0', text: 'A\nB ', marks: [] },
      { _type: 'span', _key: 'doc1-5-1', text: 'link', marks: ['doc1-link-0'], _type: 'span' },
    ], markDefs: [{ _key: 'doc1-link-0', _type: 'link', href: 'https://x.test' }] },
    { _type: 'block', _key: 'doc1-6', style: 'blockquote', children: [
      { _type: 'span', _key: 'doc1-6-0', text: 'Quoted', marks: [] },
    ] },
    { _type: 'block', _key: 'doc1-7', style: 'normal', children: [
      { _type: 'span', _key: 'doc1-7-0', text: 'Plain ', marks: [] },
      { _type: 'span', _key: 'doc1-7-1', text: 'bold', marks: ['strong'] },
      { _type: 'span', _key: 'doc1-7-2', text: ' ', marks: [] },
      { _type: 'span', _key: 'doc1-7-3', text: 'italic', marks: ['em'] },
      { _type: 'span', _key: 'doc1-7-4', text: ' text', marks: [] },
    ] },
  ]);
});

test('maps the seeded privacy-policy document to a prose block', () => {
  const node = privacyFixture.content[0];
  const result = convertBlock(node);
  assert.equal(result.block._type, 'prose');
  assert.equal(result.block.variant, 'centered');
  assert.equal(result.block.heading, 'Privacy Policy');
  assert.equal(result.block.body, 'Last updated on December 19, 2025.');
  const content = result.block.content;
  assert.equal(content[0].style, 'normal');
  assert.ok(content[0].children.some((span) => span.marks?.includes('strong')));
  const headings = content.filter((block) => block.style?.startsWith('h'));
  assert.equal(headings.length, 3);
  assert.equal(headings[0].style, 'h2');
  const bullets = content.filter((block) => block.listItem === 'bullet');
  assert.equal(bullets.length, 4);
  const link = content.flatMap((block) => block.markDefs ?? []).find((def) => def._type === 'link');
  assert.equal(link.href, 'mailto:privacy@company.example');
  const contact = content.find((block) => block.children?.some((span) => span.text.includes('Email:')));
  assert.match(contact.children.map((span) => span.text).join(''), /\n/);
  // Round-trip property: converting the converted HTML is byte-stable.
  assert.equal(convertBlock(node).block.content.length, content.length);
});

test('stops document conversion on markup the editor cannot represent', () => {
  assert.match(convertBlock({ ...privacyFixture.content[0], content: '<table><tr><td>x</td></tr></table>' }).stop, /table/);
  assert.match(convertBlock({ ...privacyFixture.content[0], content: '' }).stop, /empty/);
  assert.match(convertBlock({ ...privacyFixture.content[0], headline: '' }).stop, /headline/);
});

const paragraph = (key, text) => ({ _type: 'block', _key: key, style: 'normal', children: [{ _type: 'span', _key: `${key}-0`, text, marks: [] }] });
const heading = (key, text, level = 'h2') => ({ _type: 'block', _key: key, style: level, children: [{ _type: 'span', _key: `${key}-0`, text, marks: [] }] });
const services = { consulting: '01SVC' };
const resolveService = async (slug) => {
	if (!(slug in services)) throw new Error(`service "${slug}" not found`);
	return services[slug];
};

test('convertPage maps marketing blocks and prose runs in content order', async () => {
  const { convertPage } = await import('./move-content-to-layout.mjs');
  const data = {
    content: [
      homeFixture.content[0],
      heading('story-title', 'The story'),
      paragraph('p1', 'First paragraph.'),
      paragraph('p2', 'Second paragraph.'),
      { _type: 'marketing.cta', _key: 'cta9', variation: 'centered', headline: 'Talk', primaryCtaLabel: 'Email', primaryCtaUrl: 'mailto:x' },
    ],
  };
  const result = await convertPage(data, { resolveService });
  assert.deepEqual(result.layout.map((block) => block._type), ['hero', 'prose', 'cta']);
  const prose = result.layout[1];
  assert.equal(prose.heading, 'The story');
  assert.deepEqual(prose.content.map((block) => block._key), ['p1', 'p2']);
  assert.deepEqual(result.moves, [
    { from: 'marketing.hero', to: 'hero', key: 'hero' },
    { from: 'plain', to: 'prose', key: 'story-title' },
    { from: 'marketing.cta', to: 'cta', key: 'cta9' },
  ]);
});

test('a plain run without a leading heading or with only a heading stops the page', async () => {
  const { convertPage } = await import('./move-content-to-layout.mjs');
  const noHeading = await convertPage({ content: [paragraph('p1', 'Lonely.')] }, { resolveService });
  assert.ok(noHeading.stopped.some((reason) => /no heading/.test(reason)));
  const headingOnly = await convertPage({ content: [heading('h', 'Just a title')] }, { resolveService });
  assert.ok(headingOnly.stopped.some((reason) => /only a heading/.test(reason)));
  assert.equal(headingOnly.layout, undefined);
});

test('an unmappable marketing block stops the whole page and lists every reason', async () => {
  const { convertPage } = await import('./move-content-to-layout.mjs');
  const result = await convertPage({
    content: [
      homeFixture.content[0],
      { _type: 'marketing.pricing', _key: 'px', headline: 'Pricing', plans: [{ name: 'Pro' }] },
      { _type: 'marketing.team', _key: 'mx', members: [{ name: 'Ann' }] },
    ],
  }, { resolveService });
  assert.equal(result.layout, undefined);
  assert.equal(result.stopped.length, 2);
  assert.match(result.stopped[0], /marketing\.pricing \(px\)/);
  assert.match(result.stopped[1], /marketing\.team \(mx\)/);
});

test('converted blocks already in layout make the page unchanged; conflicting keys stop it', async () => {
  const { convertPage } = await import('./move-content-to-layout.mjs');
  const data = { content: [homeFixture.content[0]] };
  const first = await convertPage(data, { resolveService });
  assert.equal(await convertPage({ ...data, layout: first.layout }, { resolveService }), null);
  const conflict = await convertPage({ ...data, layout: [{ _type: 'hero', _key: 'hero', _version: 1, variant: 'demo', heading: 'Other' }] }, { resolveService });
  assert.match(conflict.stopped[0], /different.*hero.*key 'hero'|key 'hero'.*different/);
});

test('new blocks append after blocks already in layout', async () => {
  const { convertPage } = await import('./move-content-to-layout.mjs');
  const existing = [{ _type: 'cta', _key: 'existing-cta', _version: 1, variant: 'start', heading: 'Earlier', links: [] }];
  const result = await convertPage({ content: [homeFixture.content[0]], layout: existing }, { resolveService });
  assert.deepEqual(result.layout.map((block) => block._key), ['existing-cta', 'hero']);
});

test('a page the service blocks agree on writes one service; disagreement or a foreign service stops it', async () => {
  const { convertPage } = await import('./move-content-to-layout.mjs');
  const ok = await convertPage({
    content: [
      { _type: 'marketing.testimonials', _key: 't1', serviceSlug: 'consulting' },
      { _type: 'marketing.faq', _key: 'q1', serviceSlug: 'consulting' },
    ],
  }, { resolveService });
  assert.equal(ok.service, '01SVC');
  const clash = await convertPage({
    content: [
      { _type: 'marketing.testimonials', _key: 't1', serviceSlug: 'consulting' },
      { _type: 'marketing.team', _key: 'm1', serviceSlug: 'other' },
    ],
  }, { resolveService });
  assert.match(clash.stopped.find((reason) => /more than one service/.test(reason)) ?? clash.stopped[0], /service/);
  const foreign = await convertPage({
    content: [{ _type: 'marketing.pricing', _key: 'p1', serviceSlug: 'consulting' }],
    service: '01OTHER',
  }, { resolveService });
  assert.ok(foreign.stopped.some((reason) => /already targets a different service/.test(reason)));
  const missing = await convertPage({
    content: [{ _type: 'marketing.pricing', _key: 'p1', serviceSlug: 'ghost' }],
  }, { resolveService });
  assert.ok(missing.stopped.some((reason) => /service "ghost" not found/.test(reason)));
  const same = await convertPage({
    content: [{ _type: 'marketing.pricing', _key: 'p1', serviceSlug: 'consulting' }],
    service: '01SVC',
  }, { resolveService });
  assert.equal(same.service, undefined);
});

test('pages with nothing to move are unchanged', async () => {
  const { convertPage } = await import('./move-content-to-layout.mjs');
  assert.equal(await convertPage({ content: [] }, { resolveService }), null);
  assert.equal(await convertPage({ content: [], layout: [{ _type: 'cta', _key: 'c', _version: 1, variant: 'start', heading: 'X', links: [] }] }, { resolveService }), null);
});

/** A fake EmDash site: cursor-paginated pages, guarded writes, publish flow. */
function fakeSite() {
  const store = {
    'home-id': { id: 'home-id', slug: 'home', status: 'published', data: structuredClone(homeFixture), draftRevisionId: null },
    'pp-id': { id: 'pp-id', slug: 'privacy-policy', status: 'published', data: structuredClone(privacyFixture), draftRevisionId: null },
    'draft-id': { id: 'draft-id', slug: 'contact', status: 'draft', data: { title: 'Contact', content: [{ _type: 'marketing.cta', _key: 'cta1', variation: 'left-aligned', headline: 'Say hi', primaryCtaLabel: 'Email', primaryCtaUrl: 'mailto:h@x.test' }] }, draftRevisionId: null },
    'stopped-id': { id: 'stopped-id', slug: 'legacy', status: 'published', data: { title: 'Legacy', content: [{ _type: 'marketing.pricing', _key: 'p1', headline: 'Plans', plans: [{ name: 'Pro', price: '$1' }] }] }, draftRevisionId: null },
    'empty-id': { id: 'empty-id', slug: 'about', status: 'published', data: { title: 'About Us', content: [] }, draftRevisionId: null },
  };
  const revisions = new Map(Object.keys(store).map((id) => [id, `rev-${id}-1`]));
  const calls = [];
  const record = (method, path, body) => calls.push({ method, path, ...(body ? { body } : {}) });
  const http = async (url, options = {}) => {
    const { pathname, searchParams } = new URL(url);
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : undefined;
    record(method, pathname + (searchParams.toString() ? `?${searchParams}` : ''), body);
    const reply = (data, status = 200) => Response.json({ success: true, data }, { status });
    if (method === 'GET' && pathname === '/_emdash/api/content/pages') {
      const cursor = searchParams.get('cursor');
      const items = cursor
        ? Object.values(store).slice(1).map(({ id, slug, status }) => ({ id, slug, status }))
        : [Object.values(store)[0]].map(({ id, slug, status }) => ({ id, slug, status }));
      return reply({ items, ...(cursor ? {} : { nextCursor: 'page-2' }) });
    }
    if (method === 'GET' && pathname.startsWith('/_emdash/api/content/pages/')) {
      const key = pathname.split('/').pop();
      const item = store[key] ?? Object.values(store).find((page) => page.slug === key);
      if (!item) return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'no page' } }, { status: 404 });
      return reply({ item: structuredClone({ ...item, data: item.data, draftRevisionId: item.draftRevisionId, liveData: undefined }), _rev: revisions.get(item.id) });
    }
    if (method === 'PUT' && pathname.startsWith('/_emdash/api/content/pages/')) {
      const id = pathname.split('/').pop();
      const item = store[id];
      if (body._rev !== revisions.get(id)) return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
      Object.assign(item.data, body.data);
      revisions.set(id, `rev-${id}-2`);
      if (item.status === 'published') item.draftRevisionId = `rev-${id}-2`;
      return reply({ item: structuredClone(item) });
    }
    if (method === 'POST' && pathname.endsWith('/publish')) {
      const id = pathname.split('/')[5];
      const item = store[id];
      if (body._rev !== revisions.get(id)) return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Revision changed' } }, { status: 409 });
      if (!item.draftRevisionId) return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Nothing staged' } }, { status: 409 });
      item.draftRevisionId = null;
      return reply({ item: structuredClone(item), _rev: revisions.get(id) });
    }
    return Response.json({ success: false, error: { code: 'NOT_FOUND', message: `no route ${method} ${pathname}` } }, { status: 404 });
  };
  return { store, calls, http };
}

test('plans every page with revisions and moves, and writes nothing', async () => {
  const { migratePages } = await import('./move-content-to-layout.mjs');
  const site = fakeSite();
  const result = await migratePages({ site: 'http://localhost:4999', token: 'fake', http: site.http });
  assert.deepEqual(result.pages.map((page) => [page.slug, page.action]), [
    ['home', 'move-content-to-layout'], ['privacy-policy', 'move-content-to-layout'], ['contact', 'move-content-to-layout'],
    ['legacy', 'stopped'], ['about', 'unchanged'],
  ]);
  assert.equal(result.applied, false);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, 0);
  const home = result.pages[0];
  assert.equal(home.revision, 'rev-home-id-1');
  assert.deepEqual(home.moves, [{ from: 'marketing.hero', to: 'hero', key: 'hero' }]);
  assert.deepEqual(home.skipped, [{ block: 'hero', field: 'variation', reason: 'not rendered when centered' }]);
  const privacy = result.pages[1];
  assert.deepEqual(privacy.moves, [{ from: 'marketing.document', to: 'prose', key: privacyFixture.content[0]._key }]);
  assert.match(result.pages[3].stopReason[0], /marketing\.pricing/);
});

test('applies with _rev, publishes published pages through the policy, keeps drafts as drafts', async () => {
  const { migratePages } = await import('./move-content-to-layout.mjs');
  const site = fakeSite();
  const result = await migratePages({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.applied, true);
  const puts = site.calls.filter((call) => call.method === 'PUT');
  assert.deepEqual(puts.map((call) => call.path.split('/').pop()), ['home-id', 'pp-id', 'draft-id']);
  for (const put of puts) assert.match(put.body._rev, /^rev-\w+-id-1$/);
  assert.deepEqual(puts[0].body.data.layout.map((block) => block._type), ['hero']);
  const publishes = site.calls.filter((call) => call.method === 'POST' && call.path.endsWith('/publish'));
  assert.deepEqual(publishes.map((call) => call.path.split('/')[5]), ['home-id', 'pp-id']);
  for (const publish of publishes) assert.match(publish.body._rev, /^rev-\w+-id-2$/);
  assert.equal(site.store['home-id'].status, 'published');
  assert.equal(site.store['home-id'].draftRevisionId, null);
  assert.ok(site.store['home-id'].data.layout[0].heading.includes('AI-native'));
  assert.equal(site.store['draft-id'].status, 'draft');
  assert.equal(site.store['stopped-id'].data.layout, undefined);
  assert.equal(site.calls.filter((call) => call.path.startsWith('/_emdash/api/content/pages/stopped-id') && call.method === 'PUT').length, 0);
  assert.equal(result.pages.find((page) => page.slug === 'contact').published, undefined);
  assert.equal(result.pages.find((page) => page.slug === 'home').published, true);
});

test('a second apply run changes nothing', async () => {
  const { migratePages } = await import('./move-content-to-layout.mjs');
  const site = fakeSite();
  await migratePages({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  const writesBefore = site.calls.filter((call) => call.method !== 'GET').length;
  const rerun = await migratePages({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.deepEqual(rerun.pages.map((page) => [page.slug, page.action]), [
    ['home', 'unchanged'], ['privacy-policy', 'unchanged'], ['contact', 'unchanged'], ['legacy', 'stopped'], ['about', 'unchanged'],
  ]);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, writesBefore);
});

test('--page limits the run to one page fetched by slug', async () => {
  const { migratePages } = await import('./move-content-to-layout.mjs');
  const site = fakeSite();
  const result = await migratePages({ site: 'http://localhost:4999', token: 'fake', page: 'home', http: site.http });
  assert.deepEqual(result.pages.map((page) => page.slug), ['home']);
  assert.equal(site.calls.filter((call) => call.path.includes('status=all')).length, 0);
});

test('write failures mark the page, keep going, and fail the run', async () => {
  const { main } = await import('./move-content-to-layout.mjs');
  const site = fakeSite();
  const output = [];
  const failing = async (url, options = {}) => {
    if ((options.method ?? 'GET') === 'PUT') return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
    return site.http(url, options);
  };
  const code = await main(['http://localhost:4999', '--apply'], { token: 'fake', http: failing, out: (text) => output.push(JSON.parse(text)) });
  assert.equal(code, 1);
  assert.equal(output[0].errors.length, 3);
  assert.equal(output[0].errors[0].code, 'CONFLICT');
});

test('missing revisions and insecure destinations stop before any request', async () => {
  const { main } = await import('./move-content-to-layout.mjs');
  const output = [];
  const noRev = async (url, options = {}) => {
    if (new URL(url).pathname === '/_emdash/api/content/pages') {
      return Response.json({ success: true, data: { items: [{ id: 'home-id', slug: 'home', status: 'draft' }] } });
    }
    return Response.json({ success: true, data: { item: { id: 'home-id', slug: 'home', status: 'draft', data: { content: [homeFixture.content[0]] } } } });
  };
  assert.equal(await main(['http://localhost:4999', '--apply'], { token: 'fake', http: noRev, out: (text) => output.push(JSON.parse(text)) }), 1);
  assert.match(output[0].errors[0].message, /no _rev/);
  const insecure = async () => { assert.fail('insecure destination must not receive a token'); };
  assert.equal(await main(['http://example.test'], { token: 'fake', http: insecure, out: (text) => output.push(JSON.parse(text)) }), 1);
  assert.match(output[1].errors[0].message, /HTTPS/);
});
