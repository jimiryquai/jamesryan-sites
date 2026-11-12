import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertBlock } from './move-content-to-layout.mjs';

const homeFixture = JSON.parse(readFileSync(new URL('./fixtures/page-builder/home.json', import.meta.url)));
const privacyFixture = JSON.parse(readFileSync(new URL('./fixtures/page-builder/privacy-policy.json', import.meta.url)));

/** A moved page's layout is exactly what 21's conversion produces. */
const convertedHome = () => convertBlock(homeFixture.content[0]).block;
const convertedPrivacy = () => convertBlock(privacyFixture.content[0]).block;
const convertedCta = () => convertBlock({ _type: 'marketing.cta', _key: 'cta1', variation: 'left-aligned', headline: 'Say hi', primaryCtaLabel: 'Email', primaryCtaUrl: 'mailto:h@x.test' }).block;

/** A fake EmDash site: cursor-paginated pages, guarded writes, publish flow,
 * and the schema endpoints that retire the field. */
function fakeSite({ pages = [], fields = ['title', 'content', 'layout', 'service'] } = {}) {
	const store = new Map(pages.map((page) => [page.id, structuredClone(page)]));
	const schema = { fields: [...fields] };
	const revisions = new Map([...store.keys()].map((id, index) => [id, `rev-${id}-${index + 1}`]));
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
			const all = [...store.values()].map(({ id, slug, status }) => ({ id, slug, status }));
			const items = cursor ? all.slice(1) : all.slice(0, 1);
			return reply({ items, ...(cursor || all.length <= 1 ? {} : { nextCursor: 'page-2' }) });
		}
		if (method === 'GET' && pathname.startsWith('/_emdash/api/content/pages/')) {
			const key = decodeURIComponent(pathname.split('/').pop());
			const item = store.get(key) ?? [...store.values()].find((page) => page.slug === key);
			if (!item) return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'no page' } }, { status: 404 });
			return reply({ item: structuredClone(item), _rev: revisions.get(item.id) });
		}
		if (method === 'PUT' && pathname.startsWith('/_emdash/api/content/pages/')) {
			const id = pathname.split('/').pop();
			const item = store.get(id);
			if (!item) return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'no page' } }, { status: 404 });
			if (body._rev !== revisions.get(id)) return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
			Object.assign(item.data, body.data);
			revisions.set(id, `rev-${id}-cleared`);
			if (item.status === 'published') item.draftRevisionId = `rev-${id}-cleared`;
			return reply({ item: structuredClone(item) });
		}
		if (method === 'POST' && pathname.endsWith('/publish')) {
			const id = pathname.split('/')[5];
			const item = store.get(id);
			if (body._rev !== revisions.get(id)) return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Revision changed' } }, { status: 409 });
			if (!item.draftRevisionId) return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Nothing staged' } }, { status: 409 });
			item.draftRevisionId = null;
			return reply({ item: structuredClone(item) });
		}
		if (method === 'GET' && pathname === '/_emdash/api/schema/collections/pages') {
			return reply({ item: { slug: 'pages', fields: schema.fields.map((slug) => ({ slug })) } });
		}
		if (method === 'DELETE' && pathname === '/_emdash/api/schema/collections/pages/fields/content') {
			const index = schema.fields.indexOf('content');
			if (index < 0) return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'no content field' } }, { status: 404 });
			schema.fields.splice(index, 1);
			for (const item of store.values()) delete item.data.content;
			return reply({ success: true });
		}
		return Response.json({ success: false, error: { code: 'NOT_FOUND', message: `no route ${method} ${pathname}` } }, { status: 404 });
	};
	return { store, schema, calls, http };
}

/** Pages in the states the retirement meets in the wild. */
function retirementPages() {
	return [
		{ id: 'moved-id', slug: 'home', status: 'published', draftRevisionId: null,
			data: { title: 'Home', content: structuredClone(homeFixture.content), layout: [convertedHome()] } },
		{ id: 'document-id', slug: 'privacy-policy', status: 'published', draftRevisionId: null,
			data: { title: 'Privacy Policy', content: structuredClone(privacyFixture.content), layout: [convertedPrivacy()] } },
		{ id: 'empty-id', slug: 'about', status: 'published', draftRevisionId: null,
			data: { title: 'About Us', content: [] } },
		{ id: 'draft-id', slug: 'contact', status: 'draft', draftRevisionId: null,
			data: { title: 'Contact', content: [{ _type: 'marketing.cta', _key: 'cta1', variation: 'left-aligned', headline: 'Say hi', primaryCtaLabel: 'Email', primaryCtaUrl: 'mailto:h@x.test' }],
				layout: [convertedCta()] } },
		{ id: 'unmoved-id', slug: 'legacy-hero', status: 'published', draftRevisionId: null,
			data: { title: 'Legacy', content: structuredClone(homeFixture.content) } },
		{ id: 'stopped-id', slug: 'legacy-pricing', status: 'published', draftRevisionId: null,
			data: { title: 'Stopped', content: [{ _type: 'marketing.pricing', _key: 'p1', headline: 'Plans', plans: [{ name: 'Pro', price: '$1' }] }] } },
	];
}

test('plans every page, names the unmoved ones, and writes nothing', async () => {
	const { retirePagesContent } = await import('./retire-pages-content.mjs');
	const site = fakeSite({ pages: retirementPages() });
	const result = await retirePagesContent({ site: 'http://localhost:4999', token: 'fake', http: site.http });
	assert.equal(result.applied, false);
	assert.equal(result.ready, false);
	assert.deepEqual(result.unmoved.map((page) => page.slug), ['legacy-hero', 'legacy-pricing']);
	assert.match(result.unmoved[0].moves[0].from, /marketing\.hero/);
	assert.match(result.unmoved[1].stopReason[0], /marketing\.pricing/);
	assert.deepEqual(result.pages.map((page) => [page.slug, page.action]), [
		['home', 'clear-content'], ['privacy-policy', 'clear-content'], ['about', 'already-clear'],
		['contact', 'clear-content'], ['legacy-hero', 'unmoved'], ['legacy-pricing', 'unmoved'],
	]);
	assert.equal(result.fieldDeleted, false);
	assert.equal(site.calls.filter((call) => call.method !== 'GET').length, 0);
	assert.ok(site.schema.fields.includes('content'));
});

test('apply refuses while any page is unmoved, writing nothing and failing the run', async () => {
	const { main } = await import('./retire-pages-content.mjs');
	const site = fakeSite({ pages: retirementPages() });
	const output = [];
	const code = await main(['http://localhost:4999', '--apply'], { token: 'fake', http: site.http, out: (text) => output.push(text) });
	assert.equal(code, 1);
	const result = JSON.parse(output[0]);
	assert.equal(result.ready, false);
	assert.equal(result.applied, false);
	assert.equal(result.fieldDeleted, false);
	assert.equal(site.calls.filter((call) => call.method !== 'GET').length, 0);
	for (const page of site.store.values()) assert.ok(page.data.content.length > 0 || page.slug === 'about');
	assert.ok(site.schema.fields.includes('content'));
});

/** The same site after 21's script has moved every unmoved page. */
function readyPages() {
	return retirementPages().map((page) => {
		if (page.id === 'unmoved-id') page.data.layout = [convertedHome()];
		if (page.id === 'stopped-id') {
			page.data.layout = [convertBlock(page.data.content[0]).block];
			page.data.content = [];
		}
		return page;
	});
}

test('apply on a ready site clears every page, republishes published pages, deletes the field and reads back', async () => {
	const { retirePagesContent } = await import('./retire-pages-content.mjs');
	const site = fakeSite({ pages: readyPages() });
	const result = await retirePagesContent({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
	assert.equal(result.ready, true);
	assert.equal(result.applied, true);
	assert.equal(result.fieldDeleted, true);
	// Only pages holding content are written; already-clear pages are untouched.
	const puts = site.calls.filter((call) => call.method === 'PUT');
	assert.deepEqual(puts.map((call) => call.path.split('/').pop()), ['moved-id', 'document-id', 'draft-id', 'unmoved-id']);
	for (const put of puts) assert.match(put.body._rev, /^rev-\w+-id-\d+$/);
	for (const put of puts) assert.deepEqual(put.body.data.content, []);
	// Published pages are republished through the policy; the draft stays a draft.
	const publishes = site.calls.filter((call) => call.method === 'POST' && call.path.endsWith('/publish'));
	assert.deepEqual(publishes.map((call) => call.path.split('/')[5]), ['moved-id', 'document-id', 'unmoved-id']);
	for (const publish of publishes) assert.equal(publish.body._rev, `rev-${publish.path.split('/')[5]}-cleared`);
	for (const [id, page] of site.store) {
		assert.equal(page.data.content, undefined, `${page.slug} lost its content key with the field`);
		if (page.status === 'published') {
			assert.equal(page.draftRevisionId, null);
			const entry = result.pages.find((candidate) => candidate.id === id);
			assert.equal(entry.published, entry.action === 'clear-content' ? true : undefined);
		}
	}
	assert.equal(result.pages.find((entry) => entry.slug === 'about').action, 'already-clear');
	assert.equal(result.pages.find((entry) => entry.slug === 'contact').published, undefined);
	assert.ok(result.pages.every((page) => page.applied));
	// The field deletion happens once, after every page is clear, and is read back.
	const deletes = site.calls.filter((call) => call.method === 'DELETE');
	assert.deepEqual(deletes.map((call) => call.path), ['/_emdash/api/schema/collections/pages/fields/content']);
	assert.ok(site.calls.some((call) => call.method === 'GET' && call.path.startsWith('/_emdash/api/schema/collections/pages?')));
	assert.ok(!site.schema.fields.includes('content'));
});

test('a failed clear marks the page, keeps the field, and fails the run', async () => {
	const { main } = await import('./retire-pages-content.mjs');
	const site = fakeSite({ pages: readyPages() });
	const output = [];
	const failing = async (url, options = {}) => {
		if ((options.method ?? 'GET') === 'PUT' && new URL(url).pathname.endsWith('/document-id')) {
			return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
		}
		return site.http(url, options);
	};
	const code = await main(['http://localhost:4999', '--apply'], { token: 'fake', http: failing, out: (text) => output.push(text) });
	assert.equal(code, 1);
	const result = JSON.parse(output[0]);
	assert.equal(result.applied, false);
	assert.equal(result.fieldDeleted, false);
	assert.match(result.errors.find((error) => error.page === 'privacy-policy').message, /Page changed/);
	assert.equal(result.pages.find((page) => page.slug === 'privacy-policy').applied, false);
	assert.equal(result.pages.find((page) => page.slug === 'home').applied, true);
	// No field deletion and no publish of the failed page.
	assert.equal(site.calls.filter((call) => call.method === 'DELETE').length, 0);
	assert.ok(!site.calls.some((call) => call.method === 'POST' && call.path.includes('/document-id/publish')));
	assert.ok(site.schema.fields.includes('content'));
	// The cleared page keeps its cleared draft until a rerun republishes it.
	assert.deepEqual(site.store.get('moved-id').data.content, []);
});

test('a rerun after retirement plans nothing, writes nothing, and succeeds', async () => {
	const { retirePagesContent } = await import('./retire-pages-content.mjs');
	const site = fakeSite({ pages: readyPages() });
	await retirePagesContent({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
	const writesBefore = site.calls.filter((call) => call.method !== 'GET').length;
	const rerun = await retirePagesContent({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
	assert.equal(rerun.ready, true);
	assert.equal(rerun.applied, false);
	assert.equal(rerun.fieldDeleted, false);
	assert.deepEqual(rerun.unmoved, []);
	assert.ok(rerun.pages.every((page) => page.action === 'already-clear'));
	assert.equal(site.calls.filter((call) => call.method !== 'GET').length, writesBefore);
});

test('the committed seed ships pages in layout with no content field', async () => {
	const seed = JSON.parse(readFileSync(new URL('../apps/marketing-site/seed/seed.json', import.meta.url)));
	const pages = seed.collections.find((collection) => collection.slug === 'pages');
	assert.deepEqual(pages.fields.map((field) => field.slug), ['title', 'layout', 'service']);
	for (const page of seed.content.pages) {
		assert.equal('content' in page.data, false, `${page.slug} still carries content`);
	}
});
