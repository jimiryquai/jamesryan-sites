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
 * the run refuses while any page is unmoved. Once ready it clears each page's
 * `content` with the `_rev` from that check. Publish uses the revision of the
 * read-back only when that whole draft equals the planned page with `content`
 * cleared; a later edit is not published. A published page that still has a
 * pending draft is published only when `liveData` shows that draft is exactly
 * the cleared content. Missing live data, or any other pending draft, blocks
 * the run. Before the schema delete, the page list is
 * read again and every page must still be migrated, clear, and free of a
 * pending draft. That read is not a collection lock: EmDash fences one entry
 * with `_rev`, and the field DELETE has no collection revision, so a write
 * that arrives after the read can still race it.
 *
 * Plan mode exits 0 whatever it finds; `--apply` exits 1 when it refuses or
 * any write fails. `applied` is true only when this run deleted the field; a
 * rerun against an already-retired site changes nothing.
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

	const resolveService = makeServiceResolver(request);
	const checked = new Map();
	const refs = await listPages(request);
	const pages = [];
	const unmoved = [];
	const blocked = [];
	const errors = [];
	for (const ref of refs) {
		const entry = await planPage(ref);
		pages.push(entry.page);
		if (entry.unmoved) unmoved.push(entry.unmoved);
		if (entry.blocked) blocked.push(entry.blocked);
		if (entry.error) errors.push(entry.error);
	}
	const ready = !unmoved.length && !blocked.length && !errors.length;
	const result = {
		site: base.origin, collection: COLLECTION, field: FIELD,
		ready, applied: false, fieldDeleted: false, pages, unmoved,
		summary: {
			pages: pages.length,
			unmoved: unmoved.length,
			clearContent: pages.filter((page) => page.action === 'clear-content').length,
			republishClear: pages.filter((page) => page.action === 'republish-clear').length,
			pendingDraft: blocked.length,
		},
		...(blocked.length ? { blocked } : {}),
		...(errors.length ? { errors } : {}),
	};
	if (!apply || !ready) return result;
	return applyRetirement(result, { request, resolveService, checked });

	async function planPage(ref) {
		const current = await readPage(request, ref.id);
		const item = current.item;
		const page = { id: item.id, slug: item.slug, status: item.status, revision: current._rev };
		checked.set(item.id, snapshotPage(item, current._rev));
		const unmovedFor = (extra) => ({ page: { ...page, action: 'unmoved', applied: false, ...extra }, unmoved: { id: item.id, slug: item.slug, ...extra } });
		try {
			const plan = await convertPage(item.data ?? {}, { resolveService });
			if (plan?.stopped) return unmovedFor({ stopReason: plan.stopped });
			if (plan) return unmovedFor({ moves: plan.moves });
			const pending = classifyPendingDraft(item);
			if (pending === 'unverifiable' || pending === 'unrelated') {
				return blockPending(page, item, pendingMessage(item.slug, pending));
			}
			if (pending === 'verified') {
				const livePlan = await convertPage(item.liveData ?? {}, { resolveService });
				if (livePlan) {
					return blockPending(page, item, `page ${item.slug} has a pending draft that would publish over content still needing migration; refusing to publish it or delete the content field`);
				}
				return { page: { ...page, action: 'republish-clear', applied: false } };
			}
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

/** The state `convertPage` accepted. Writes use this revision, not a later read. */
function snapshotPage(item, revision) {
	return {
		revision,
		status: item.status,
		draftRevisionId: item.draftRevisionId ?? null,
		data: structuredClone(item.data ?? {}),
		liveData: item.liveData == null ? null : structuredClone(item.liveData),
	};
}

/**
 * A published pending draft is safe to publish only when it clears `content`
 * and leaves every other field equal to the live page. EmDash GET hydration
 * (`hydrateDraftData`) puts that draft in `item.data` and the published
 * columns in `item.liveData` whenever `draftRevisionId` is set. A missing
 * `liveData` is the unhydrated row, which cannot prove the draft, so it is
 * not published.
 */
function classifyPendingDraft(item) {
	if (item.status !== 'published' || !item.draftRevisionId) return 'none';
	if (!item.liveData || typeof item.liveData !== 'object' || Array.isArray(item.liveData)) return 'unverifiable';
	const draft = item.data ?? {};
	const live = item.liveData;
	if ((draft[FIELD] ?? []).length > 0) return 'unrelated';
	const keys = new Set([...Object.keys(draft), ...Object.keys(live)]);
	for (const key of keys) {
		if (key === FIELD) continue;
		if (!isDeepStrictEqual(draft[key], live[key])) return 'unrelated';
	}
	return 'verified';
}

function pendingMessage(slug, pending) {
	if (pending === 'unverifiable') {
		return `page ${slug} has a pending draft with no live data to compare; refusing to publish it or delete the content field`;
	}
	return `page ${slug} has a pending draft that is not a verified content clear; refusing to publish it or delete the content field`;
}

function blockPending(page, item, message) {
	return {
		page: { ...page, action: 'pending-draft', applied: false, error: { message } },
		blocked: { id: item.id, slug: item.slug, message },
	};
}

/** Every page, every status, through the list cursor. */
async function listPages(request) {
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
	return refs;
}

async function readPage(request, id) {
	const current = await request(`/_emdash/api/content/${COLLECTION}/${encodeURIComponent(id)}`);
	const item = current.item;
	if (!item || item.id !== id) throw new Error(`Expected page ${id}`);
	return current;
}

/** The writes: clear or republish every planned page, recheck the list, then delete the field. */
async function applyRetirement(result, { request, resolveService, checked }) {
	const errors = [];
	for (const page of result.pages) {
		try {
			if (page.action === 'clear-content') await clearPage(page, { request, checked });
			if (page.action === 'republish-clear') await republishClear(page, { request, checked });
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
			await assertCollectionStillRetired({ request, resolveService });
			fieldDeleted = await deleteField({ request });
		} catch (error) {
			errors.push(shapeError(error, error.page ?? 'schema'));
		}
	}
	result.applied = !failed && fieldDeleted;
	result.fieldDeleted = fieldDeleted;
	if (errors.length) result.errors = [...(result.errors ?? []), ...errors];
	return result;
}

/** Refuse a write when the page is no longer the revision migration checked. */
function assertMatchesPlan(page, current, checked) {
	const planned = checked.get(page.id);
	const item = current.item;
	const slug = item?.slug ?? page.slug;
	if (!planned?.revision || !current._rev) {
		throw new Error(`page ${slug} response has no _rev; refusing an unguarded write`);
	}
	const changed = current._rev !== planned.revision || !samePlannedState(planned, item);
	if (changed) {
		throw new Error(`page ${slug} changed after its migration check (planned revision ${planned.revision}); refusing to write or delete it`);
	}
}

function samePlannedState(planned, item) {
	const sameDraft = isDeepStrictEqual(planned.data, item.data ?? {});
	const sameLive = isDeepStrictEqual(planned.liveData, item.liveData ?? null);
	const sameDraftPointer = (planned.draftRevisionId ?? null) === (item.draftRevisionId ?? null);
	return planned.status === item.status && sameDraftPointer && sameDraft && sameLive;
}

/** The write may land, but an unexpected body is not published or field-deleted. */
function assertClearedReadBack(planned, cleared) {
	const slug = cleared.item?.slug ?? 'unknown';
	const expected = { ...planned.data, [FIELD]: [] };
	const draftMatches = isDeepStrictEqual(cleared.item.data ?? {}, expected);
	const expectedLive = planned.status === 'published'
		? (planned.draftRevisionId ? planned.liveData : planned.data)
		: null;
	const liveMatches = planned.status !== 'published'
		|| isDeepStrictEqual(cleared.item.liveData ?? null, expectedLive);
	if (!draftMatches || !liveMatches || (cleared.item.data?.[FIELD] ?? []).length > 0) {
		throw new Error(`page ${slug} changed after its migration check (planned revision ${planned.revision}); refusing to write or delete it`);
	}
}

/** Clear one page's content with the planned `_rev`, republishing published pages. */
async function clearPage(page, { request, checked }) {
	const path = `/_emdash/api/content/${COLLECTION}/${encodeURIComponent(page.id)}`;
	const current = await readPage(request, page.id);
	assertMatchesPlan(page, current, checked);
	const planned = checked.get(page.id);
	await request(path, 'PUT', { data: { ...planned.data, [FIELD]: [] }, _rev: planned.revision });
	const cleared = await readPage(request, page.id);
	if (planned.status === 'published') {
		await publishCleared(page, cleared, planned, { request });
	} else {
		assertClearedReadBack(planned, cleared);
		page.revision = cleared._rev;
	}
}

/** Publish a draft that planning already verified is only a content clear. */
async function republishClear(page, { request, checked }) {
	const current = await readPage(request, page.id);
	assertMatchesPlan(page, current, checked);
	const planned = checked.get(page.id);
	await publishCleared(page, current, planned, { request });
}

/**
 * Publish only the revision of a read-back whose whole draft equals the
 * planned page with `content` cleared. A newer revision is not adopted.
 */
async function publishCleared(page, source, planned, { request }) {
	assertClearedReadBack(planned, source);
	const path = `/_emdash/api/content/${COLLECTION}/${encodeURIComponent(page.id)}`;
	const revision = source._rev;
	if (!revision) throw new Error(`page ${page.slug} response has no _rev; refusing an unguarded publish`);
	await request(`${path}/publish`, 'POST', { _rev: revision });
	const final = await readPage(request, page.id);
	const expected = { ...planned.data, [FIELD]: [] };
	const publishedBody = isDeepStrictEqual(final.item.data ?? {}, expected);
	if (final.item.status !== 'published' || final.item.draftRevisionId || !publishedBody) {
		throw new Error(`page ${page.slug} did not end published without a pending draft`);
	}
	if ((final.item.liveData?.[FIELD] ?? []).length > 0) {
		throw new Error(`page ${page.slug} published content was not cleared`);
	}
	page.revision = final._rev;
	page.published = true;
}

/**
 * Read the collection again. EmDash has no collection-wide revision, so this
 * cannot close the race between the read and the schema DELETE; it refuses
 * drift that is already visible, including a new page or a pending draft.
 */
async function assertCollectionStillRetired({ request, resolveService }) {
	const refs = await listPages(request);
	for (const ref of refs) {
		const current = await readPage(request, ref.id);
		const item = current.item;
		const plan = await convertPage(item.data ?? {}, { resolveService });
		if (plan) refuseField(`page ${item.slug} is not migrated; refusing to delete the content field`, item.slug);
		if ((item.data?.[FIELD] ?? []).length > 0) {
			refuseField(`page ${item.slug} still has content; refusing to delete the content field`, item.slug);
		}
		if (item.status === 'published' && item.draftRevisionId) {
			refuseField(`page ${item.slug} has an unverified pending draft; refusing to delete the content field`, item.slug);
		}
		if (item.status === 'published' && (item.liveData?.[FIELD] ?? []).length > 0) {
			refuseField(`page ${item.slug} published content is not clear; refusing to delete the content field`, item.slug);
		}
	}
}

function refuseField(message, page) {
	const error = new Error(message);
	error.page = page;
	throw error;
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
