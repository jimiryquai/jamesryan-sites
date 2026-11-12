import { pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { convertPage, guardDestination, makeServiceResolver, shapeError } from './move-content-to-layout.mjs';

/**
 * Retire the pages collection's Portable Text `content` field once Layout
 * owns every page's marketing content.
 *
 * Plans by default: every page is read and re-checked with the move script's
 * `convertPage`, so the field is only retired when that script plans nothing
 * anywhere (everything has moved, or nothing was ever there). With `--apply`
 * the run refuses while any page is unmoved; once ready it clears each page's
 * `content` (with `_rev`, republishing published pages through the publish
 * policy), deletes the `content` field through the schema API, and reads both
 * the pages and the schema back.
 *
 * Plan mode exits 0 whatever it finds; `--apply` exits 1 when it refuses or
 * any write fails. `applied` is true only when this run cleared pages or
 * deleted the field; a rerun against an already-retired site changes nothing.
 */

const COLLECTION = 'pages';
const FIELD = 'content';

/**
 * Plan (and with `apply`, perform) the retirement of the pages `content` field.
 * @param {{ site: string, token: string, apply?: boolean, http?: typeof fetch }} options
 */
export async function retirePagesContent({ site, token, apply = false, http = fetch }) {
	const base = guardDestination(site, token);
	async function request(path, method = 'GET', body) {
		const response = await http(new URL(path, base), {
			method, redirect: 'error',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			...(body ? { body: JSON.stringify(body) } : {}),
		});
		const result = await response.json();
		if (!response.ok || !result.success) {
			const error = new Error(`${method} ${path}: ${result.error?.message ?? response.statusText}`);
			Object.assign(error, { operation: `${method} ${path}`, status: response.status, code: result.error?.code });
			throw error;
		}
		return result.data;
	}

	// Every page, every status, through the list cursor.
	const refs = [];
	let cursor;
	do {
		const query = new URLSearchParams({ status: 'all', limit: '100' });
		if (cursor) query.set('cursor', cursor);
		const list = await request(`/_emdash/api/content/${COLLECTION}?${query}`);
		if (!Array.isArray(list.items)) throw new Error('pages list response has no items');
		refs.push(...list.items);
		cursor = list.nextCursor;
	} while (cursor);

	const resolveService = makeServiceResolver(request);
	const pages = [];
	const unmoved = [];
	const errors = [];
	for (const ref of refs) {
		const entry = await planPage(ref);
		pages.push(entry.page);
		if (entry.unmoved) unmoved.push(entry.unmoved);
		if (entry.error) errors.push(entry.error);
	}
	const ready = !unmoved.length && !errors.length;
	const result = {
		site: base.origin, collection: COLLECTION, field: FIELD,
		ready, applied: false, fieldDeleted: false, pages, unmoved,
		summary: {
			pages: pages.length,
			unmoved: unmoved.length,
			clearContent: pages.filter((page) => page.action === 'clear-content').length,
		},
		...(errors.length ? { errors } : {}),
	};
	if (!apply || !ready) return result;
	return applyRetirement(result, { request });

	async function planPage(ref) {
		const current = await request(`/_emdash/api/content/${COLLECTION}/${encodeURIComponent(ref.id)}`);
		const item = current.item;
		if (!item || item.id !== ref.id) throw new Error(`Expected page ${ref.id}`);
		const page = { id: item.id, slug: item.slug, status: item.status, revision: current._rev };
		const unmovedFor = (extra) => ({ page: { ...page, action: 'unmoved', applied: false, ...extra }, unmoved: { id: item.id, slug: item.slug, ...extra } });
		try {
			const plan = await convertPage(item.data ?? {}, { resolveService });
			if (plan?.stopped) return unmovedFor({ stopReason: plan.stopped });
			if (plan) return unmovedFor({ moves: plan.moves });
			const hasContent = (item.data?.[FIELD] ?? []).length > 0;
			return { page: { ...page, action: hasContent ? 'clear-content' : 'already-clear', applied: false } };
		} catch (error) {
			const shaped = shapeError(error);
			const entry = unmovedFor({ error: shaped });
			entry.error = shapeError(error, item.slug);
			return entry;
		}
	}
}

/** The writes: clear every page's content, then delete the field, then read both back. */
async function applyRetirement(result, { request }) {
	const errors = [];
	for (const page of result.pages) {
		try {
			if (page.action === 'clear-content') await clearPage(page, { request });
			page.applied = true;
		} catch (error) {
			page.applied = false;
			page.error = shapeError(error);
			errors.push(shapeError(error, page.slug));
		}
	}
	// The field is only dropped once every page's content is gone for good.
	const failed = errors.length > 0;
	let fieldDeleted = false;
	if (!failed) {
		try {
			fieldDeleted = await deleteField({ request });
		} catch (error) {
			errors.push(shapeError(error, 'schema'));
		}
	}
	result.applied = !failed && fieldDeleted;
	result.fieldDeleted = fieldDeleted;
	if (errors.length) result.errors = [...(result.errors ?? []), ...errors];
	return result;
}

/** Clear one page's content with `_rev`, republishing published pages. */
async function clearPage(page, { request }) {
	const path = `/_emdash/api/content/${COLLECTION}/${encodeURIComponent(page.id)}`;
	const current = await request(path);
	const item = current.item;
	if (!current._rev) throw new Error(`page ${item.slug} response has no _rev; refusing an unguarded write`);
	await request(path, 'PUT', { data: { ...item.data, [FIELD]: [] }, _rev: current._rev });
	const cleared = await request(path);
	if (!isDeepStrictEqual(cleared.item.data[FIELD] ?? [], [])) {
		throw new Error(`page ${item.slug} read-back content was not cleared`);
	}
	page.revision = cleared._rev;
	if (item.status === 'published') {
		await request(`${path}/publish`, 'POST', { _rev: cleared._rev });
		const final = await request(path);
		if (final.item.status !== 'published' || final.item.draftRevisionId) {
			throw new Error(`page ${item.slug} did not end published without a pending draft`);
		}
		if ((final.item.data[FIELD] ?? []).length > 0) {
			throw new Error(`page ${item.slug} published content was not cleared`);
		}
		page.revision = final._rev;
		page.published = true;
	}
}

/** Delete the content field if it still exists; false when it is already gone. */
async function deleteField({ request }) {
	const detail = await request(`/_emdash/api/schema/collections/${COLLECTION}?includeFields=true`);
	const fields = detail.item?.fields ?? [];
	const exists = fields.some((field) => field.slug === FIELD);
	if (!exists) return false;
	await request(`/_emdash/api/schema/collections/${COLLECTION}/fields/${FIELD}`, 'DELETE');
	const readBack = await request(`/_emdash/api/schema/collections/${COLLECTION}?includeFields=true`);
	if (readBack.item?.fields?.some((field) => field.slug === FIELD)) {
		throw new Error(`the ${FIELD} field is still in the schema after deletion`);
	}
	return true;
}

export async function main(argv, { token = process.env.EMDASH_TOKEN, http = fetch, out = console.log } = {}) {
	try {
		const { values, positionals } = parseArgs({
			args: argv, allowPositionals: true,
			options: { apply: { type: 'boolean' }, table: { type: 'boolean' } },
		});
		if (positionals.length !== 1) throw new Error('usage: node scripts/retire-pages-content.mjs <site-url> [--apply] [--table]');
		const result = await retirePagesContent({ site: positionals[0], token, http, apply: values.apply });
		if (values.table) {
			out([
				`site         ${result.site}`,
				`collection   ${result.collection}`,
				`field        ${result.field}`,
				`ready        ${result.ready}`,
				`applied      ${result.applied}`,
				...result.pages.map((page) => [
					`${(page.slug ?? '').padEnd(20)} ${(page.status ?? '').padEnd(10)} ${page.action}${page.published ? ' (republished)' : ''}`,
					...(page.moves ?? []).map((move) => `  unmoved: ${move.from} -> ${move.to} (${move.key})`),
					...(page.stopReason ?? []).map((reason) => `  unmoved: ${reason}`),
					...(page.error ? [`  error: ${page.error.message}`] : []),
				].join('\n')),
			].join('\n'));
		} else {
			out(JSON.stringify(result, null, 2));
		}
		if (result.errors?.length) return 1;
		if (values.apply && !result.ready) return 1;
		return 0;
	} catch (error) {
		out(JSON.stringify({ errors: [shapeError(error)] }, null, 2));
		return 1;
	}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
