import { pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { guardDestination, shapeError } from './move-content-to-layout.mjs';

/**
 * Add Home's `posts` block (variant `featured-grid`, count 4) to a live site,
 * right after the hero, when Home's layout has no posts block yet. Plans by
 * default; `--apply` writes through EmDash's content API with `_rev`
 * optimistic concurrency and republishes a published Home through the page
 * builder's publish policy. A second run plans nothing.
 */

/** The block this script adds; the seed's Home layout holds the same one. */
export const HOME_POSTS_BLOCK = {
	_type: 'posts', _key: 'posts', _version: 1, variant: 'featured-grid', count: 4,
};

/**
 * Plan the posts block for one home page's stored data.
 * @returns {{ action: 'add-home-posts-block', layout: object[] } | { action: 'unchanged' } | { action: 'stopped', stopReason: string[] }}
 */
export function planHomePostsBlock(data) {
	const layout = data.layout ?? [];
	if (layout.some((block) => block?._type === 'posts')) return { action: 'unchanged' };
	const clash = layout.find((block) => block?._key === 'posts');
	if (clash) {
		return { action: 'stopped', stopReason: [`layout already holds a ${clash._type ?? 'block'} with key 'posts'`] };
	}
	let lastHero = -1;
	for (const [index, block] of layout.entries()) {
		if (block?._type === 'hero') lastHero = index;
	}
	const at = lastHero === -1 ? layout.length : lastHero + 1;
	return { action: 'add-home-posts-block', layout: [...layout.slice(0, at), HOME_POSTS_BLOCK, ...layout.slice(at)] };
}

/** Plan by default; callers can inject HTTP without a site or credentials. */
export async function addHomePostsBlock({ site, token, apply = false, http = fetch }) {
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

	const current = await request('/_emdash/api/content/pages/home');
	const item = current.item;
	if (!item || item.slug !== 'home') throw new Error('Expected the home page at slug "home"');
	const page = { id: item.id, slug: item.slug, status: item.status, revision: current._rev };

	const plan = planHomePostsBlock(item.data ?? {});
	if (plan.action === 'unchanged') return { site: base.origin, collection: 'pages', applied: false, page: { ...page, action: 'unchanged', applied: false } };
	if (plan.action === 'stopped') return { site: base.origin, collection: 'pages', applied: false, page: { ...page, action: 'stopped', applied: false, stopReason: plan.stopReason } };

	const after = plan.layout[plan.layout.indexOf(HOME_POSTS_BLOCK) - 1]?._type ?? 'nothing';
	Object.assign(page, {
		action: 'add-home-posts-block', applied: false,
		moves: [{ after, to: 'posts', key: HOME_POSTS_BLOCK._key }],
	});
	if (!apply) return { site: base.origin, collection: 'pages', applied: false, page };
	try {
		if (!current._rev) throw new Error('home response has no _rev; refusing an unguarded write');
		const path = `/_emdash/api/content/pages/${encodeURIComponent(item.id)}`;
		await request(path, 'PUT', { data: { ...item.data, layout: plan.layout }, _rev: current._rev });
		const verified = await request(path);
		if (!isDeepStrictEqual(verified.item.data.layout, plan.layout)) {
			throw new Error('home read-back layout did not match the migration write');
		}
		page.applied = true;
		page.revision = verified._rev;
		// A published page gets a draft from the PUT; publish it through the API
		// so the page builder's publish policy runs. A draft stays a draft.
		if (item.status === 'published') {
			await request(`${path}/publish`, 'POST', { _rev: verified._rev });
			const final = await request(path);
			if (final.item.status !== 'published' || final.item.draftRevisionId) {
				throw new Error('home did not end published without a pending draft');
			}
			if (!isDeepStrictEqual(final.item.data.layout, plan.layout)) {
				throw new Error('home published layout did not match the migration write');
			}
			page.revision = final._rev;
			page.published = true;
		}
	} catch (error) {
		page.applied = false;
		page.error = shapeError(error);
		return { site: base.origin, collection: 'pages', applied: false, page };
	}
	return { site: base.origin, collection: 'pages', applied: page.applied, page };
}

export async function main(argv, { token = process.env.EMDASH_TOKEN, http = fetch, out = console.log } = {}) {
	try {
		const { values, positionals } = parseArgs({
			args: argv, allowPositionals: true,
			options: { apply: { type: 'boolean' }, table: { type: 'boolean' } },
		});
		if (positionals.length !== 1) throw new Error('usage: node scripts/add-home-posts-block.mjs <site-url> [--apply] [--table]');
		const result = await addHomePostsBlock({ site: positionals[0], token, http, apply: values.apply });
		if (values.table) {
			out([
				`site         ${result.site}`,
				`collection   ${result.collection}`,
				`applied      ${result.applied}`,
				`${(result.page.slug ?? '').padEnd(20)} ${(result.page.status ?? '').padEnd(10)} ${result.page.action}`,
				...(result.page.moves ?? []).map((move) => `  after ${move.after} -> ${move.to} (${move.key})`),
				...(result.page.stopReason ?? []).map((reason) => `  stopped: ${reason}`),
				...(result.page.error ? [`  error: ${result.page.error.message}`] : []),
			].join('\n'));
		} else {
			out(JSON.stringify(result, null, 2));
		}
		return result.page.error ? 1 : 0;
	} catch (error) {
		out(JSON.stringify({ errors: [shapeError(error)] }, null, 2));
		return 1;
	}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
