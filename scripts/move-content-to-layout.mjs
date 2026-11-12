import { pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';

/**
 * Move every page's Portable Text marketing blocks from `content` into
 * `layout` as page-builder blocks (emdash-plugin-page-builder 0.2.0 shapes).
 *
 * The mapping is conservative: a marketing field that the page-builder block
 * has no home for stops that page with a named reason instead of being
 * dropped. Plain Portable Text runs become one `prose` block in place.
 * `content` itself is left for ticket 14 to clear.
 */

/** The marketing block types this script knows, and their target slugs. */
const TARGETS = {
	'marketing.hero': 'hero',
	'marketing.cta': 'cta',
	'marketing.features': 'features',
	'marketing.testimonials': 'testimonials',
	'marketing.pricing': 'pricing',
	'marketing.faq': 'faq',
	'marketing.stats': 'stats',
	'marketing.team': 'team',
	'marketing.comparison': 'comparison',
	'marketing.document': 'prose',
};

const isSet = (value) => value !== undefined && value !== null && String(value).trim().length > 0;

/** The concatenated span text of a Portable Text block. */
function plainTextOf(block) {
	return (block?.children ?? [])
		.filter((child) => child?._type === 'span')
		.map((span) => span.text ?? '')
		.join('')
		.trim();
}

/** One prose block for a run of plain Portable Text: its leading heading
 * becomes the section heading, the rest moves verbatim. */
function convertPlainRun(run, stopped) {
	const first = run[0];
	const text = plainTextOf(first);
	if (first?._type !== 'block' || !/^h[1-6]$/.test(first.style ?? '') || !text) {
		stopped.push(`plain content at key '${first?._key}': no heading to give the prose section`);
		return null;
	}
	const content = run.slice(1);
	if (!content.length) {
		stopped.push(`plain content at key '${first._key}': only a heading; a prose block needs content`);
		return null;
	}
	return {
		_type: 'prose', _key: first._key, _version: 1, variant: 'centered',
		heading: text, content,
	};
}

/**
 * Convert one page's `content` into blocks to append to `layout`.
 * @param {object} data the page's stored data
 * @param {{ resolveService: (slug: string) => Promise<string> }} options
 * @returns {Promise<{ layout: object[], moves: { from: string, to: string, key: string }[], skipped?: object[], service?: string } | { stopped: string[] } | null>} null when the page has nothing to move
 */
export async function convertPage(data, { resolveService }) {
	const content = data.content ?? [];
	const layout = data.layout ?? [];
	const stopped = [];
	const skipped = [];
	const converted = [];
	const serviceSlugs = new Set();
	let run = [];
	const flushRun = () => {
		if (!run.length) return;
		const prose = convertPlainRun(run, stopped);
		if (prose) converted.push({ block: prose, from: 'plain' });
		run = [];
	};
	for (const block of content) {
		if (block?._type?.startsWith('marketing.')) {
			flushRun();
			const result = convertBlock(block);
			if (result.stop) stopped.push(result.stop);
			else {
				converted.push({ block: result.block, from: block._type });
				if (result.service) serviceSlugs.add(result.service);
				if (result.skipped) skipped.push(...result.skipped);
			}
		} else {
			run.push(block);
		}
	}
	flushRun();
	if (stopped.length) return { stopped };
	if (!converted.length) return null;

	// Append only what is not already there; a re-run must change nothing.
	const existingByKey = new Map(layout.map((block) => [block._key, block]));
	const append = [];
	const moves = [];
	for (const { block, from } of converted) {
		const existing = existingByKey.get(block._key);
		if (!existing) {
			append.push(block);
			moves.push({ from, to: block._type, key: block._key });
			continue;
		}
		if (!isDeepStrictEqual(existing, block)) {
			return { stopped: [`layout already holds a different ${existing._type ?? 'block'} with key '${block._key}'`] };
		}
	}
	if (!append.length) return null;

	// Shared-content blocks scope through the page's service reference.
	const wanted = new Set();
	for (const slug of serviceSlugs) {
		try {
			wanted.add(await resolveService(slug));
		} catch (error) {
			return { stopped: [error.message] };
		}
	}
	let service;
	if (wanted.size > 1) {
		return { stopped: [`the marketing blocks name more than one service (${[...serviceSlugs].join(', ')}); a page targets one`] };
	}
	if (wanted.size === 1) {
		const [id] = wanted;
		if (isSet(data.service) && data.service !== id) {
			return { stopped: [`page already targets a different service (${data.service}) than the marketing blocks (${id})`] };
		}
		if (data.service !== id) service = id;
	}
	return { layout: [...layout, ...append], moves, ...(skipped.length ? { skipped } : {}), ...(service ? { service } : {}) };
}

/** CTA label/url pairs; an incomplete pair would lose an action, so stop. */
function convertLinks(block, prefixes) {
	const links = [];
	for (const prefix of prefixes) {
		const label = block[`${prefix}Label`];
		const url = block[`${prefix}Url`];
		if (isSet(label) !== isSet(url)) return { stop: `Incomplete ${prefix} link` };
		if (isSet(label)) links.push({ label, url });
	}
	return { links };
}

/**
 * Convert one marketing block to its page-builder shape.
 * @returns {{ block: object, skipped?: { block: string, field: string, reason: string }[], service?: string } | { stop: string }}
 */
export function convertBlock(block) {
	if (!block || typeof block !== 'object') return { stop: 'marketing block is not an object' };
	const type = block._type;
	if (!TARGETS[type]) return { stop: `Unknown marketing block type ${String(type)}` };
	const key = block._key;
	if (!isSet(key)) return { stop: `${type} block has no _key` };
	const stopped = (reason) => ({ stop: `${type} (${key}): ${reason}` });
	const mapper = {
		'marketing.hero': convertHero,
		'marketing.cta': convertCta,
		'marketing.features': convertFeatures,
		'marketing.stats': convertStats,
		'marketing.comparison': convertComparison,
		'marketing.testimonials': convertTestimonials,
		'marketing.pricing': convertPricing,
		'marketing.faq': convertFaq,
		'marketing.team': convertTeam,
		'marketing.document': convertDocument,
	}[type];
	return mapper(block, key, stopped);
}

function convertHero(block, key, stopped) {
	const centered = block.centered === true || block.centered === 'true';
	const heading = block.headline;
	if (!isSet(heading)) return stopped('hero requires a headline');
	const { links, stop } = convertLinks(block, ['primaryCta', 'secondaryCta']);
	if (stop) return stopped(stop);
	const hero = {
		_type: 'hero', _key: key, _version: 1,
		variant: 'centered', heading, body: block.subheadline ?? '', links,
		...(isSet(block.eyebrowText) ? { eyebrow: block.eyebrowText } : {}),
		...(isSet(block.eyebrowUrl) ? { eyebrow_url: block.eyebrowUrl } : {}),
		...(isSet(block.eyebrowCta) ? { eyebrow_action: block.eyebrowCta } : {}),
	};
	if (centered) {
		const skipped = [{ block: key, field: 'variation', reason: 'not rendered when centered' }];
		for (const field of ['photoUrl', 'plans', 'serviceSlug']) {
			if (isSet(block[field])) skipped.push({ block: key, field, reason: 'not rendered when centered' });
		}
		return { block: hero, skipped };
	}
	if (block.variation === 'pricing-hero-multi-tier') {
		return stopped('a pricing hero needs separate hero and pricing blocks; its plans and service pricing cannot move onto a hero');
	}
	if (block.variation === 'left-aligned-with-photo') {
		return stopped('photoUrl is a plain URL; the hero image field needs an EmDash media value');
	}
	if (!block.variation || block.variation === 'left-aligned-with-demo') {
		return stopped('the demo artwork is bundled in the renderer, not EmDash media; the hero needs a real image first');
	}
	return stopped(`unknown variation ${block.variation}`);
}

function convertCta(block, key, stopped) {
	const heading = block.headline;
	if (!isSet(heading)) return stopped('cta requires a headline');
	const { links, stop } = convertLinks(block, ['primaryCta', 'secondaryCta']);
	if (stop) return stopped(stop);
	const variation = block.variation ?? 'left-aligned';
	const variant = { 'left-aligned': 'start', centered: 'centered' }[variation];
	if (!variant) return stopped(`unknown variation ${variation}`);
	return { block: { _type: 'cta', _key: key, _version: 1, variant, heading, body: block.subheadline ?? '', links } };
}

function convertFeatures(block, key, stopped) {
	const heading = block.headline;
	if (!isSet(heading)) return stopped('features requires a heading');
	const features = block.features ?? [];
	if (!features.length) return stopped('features requires at least one item');
	const items = [];
	for (const [index, feature] of features.entries()) {
		if (!isSet(feature?.title)) return stopped(`features item ${index} requires a title`);
		items.push({
			title: feature.title,
			...(isSet(feature.description) ? { description: feature.description } : {}),
			...(isSet(feature.icon) ? { icon: feature.icon } : {}),
		});
	}
	// The marketing renderer's section is the site's two-column adapter.
	return { block: { _type: 'features', _key: key, _version: 1, variant: 'two-column', heading, subheadline: block.subheadline ?? '', items } };
}

function convertStats(block, key, stopped) {
	const heading = block.headline;
	if (!isSet(heading)) return stopped('stats requires a heading');
	const stats = block.stats ?? [];
	if (!stats.length) return stopped('stats requires at least one item');
	const items = [];
	for (const [index, stat] of stats.entries()) {
		if (!isSet(stat?.stat)) return stopped(`stats item ${index} requires a value`);
		items.push({ value: stat.stat, label: stat.text ?? '' });
	}
	return {
		block: {
			_type: 'stats', _key: key, _version: 1, variant: 'graph',
			...(isSet(block.eyebrow) ? { eyebrow: block.eyebrow } : {}),
			heading, body: block.subheadline ?? '', items,
		},
	};
}

function convertComparison(block, key, stopped) {
	const items = block.items ?? [];
	if (!items.length) return stopped('comparison requires at least one row');
	const rows = [];
	for (const [index, item] of items.entries()) {
		if (!isSet(item?.name)) return stopped(`comparison row ${index} requires a feature name`);
		rows.push({
			group_name: item.groupName ?? '', name: item.name,
			first_value: item.starterValue ?? '', second_value: item.growthValue ?? '', third_value: item.proValue ?? '',
		});
	}
	// The marketing table's plans are always Starter, Growth and Pro.
	return {
		block: {
			_type: 'comparison', _key: key, _version: 1, variant: 'table',
			columns: [
				{ key: 'first', label: 'Starter' }, { key: 'second', label: 'Growth' }, { key: 'third', label: 'Pro' },
			],
			rows,
		},
	};
}

/** Shared-content blocks: the page-builder block reads a collection, so the
 * marketing block must name the service that scopes it and carry no inline data. */
function convertSharedContent(block, key, stopped, {
	type, variant, inline: { field, label, collection }, headingRendered, subheadingRendered = false,
}) {
	if ((block[field] ?? []).length) {
		return stopped(`inline ${label} have no field on the page-builder block; move them into the ${collection} collection first`);
	}
	if (headingRendered && isSet(block.headline)) {
		return stopped(`the ${type} block has no heading field; its headline cannot move`);
	}
	if (subheadingRendered && isSet(block.subheadline)) {
		return stopped(`the ${type} block has no subheadline field; its subheadline cannot move`);
	}
	if (!isSet(block.serviceSlug)) {
		return stopped(`the ${type} block names no service; nothing determines its ${collection} content`);
	}
	return { block: { _type: type, _key: key, _version: 1, variant, scope: 'page' }, service: block.serviceSlug };
}

function convertTestimonials(block, key, stopped) {
	// The headline only renders once quotes exist, which here needs a service.
	const headingRendered = isSet(block.serviceSlug);
	return convertSharedContent(block, key, stopped, {
		type: 'testimonials', variant: 'grid', headingRendered,
		inline: { field: 'testimonials', label: 'testimonials', collection: 'testimonials' },
	});
}

function convertPricing(block, key, stopped) {
	return convertSharedContent(block, key, stopped, {
		type: 'pricing', variant: 'tiers', headingRendered: true,
		inline: { field: 'plans', label: 'plans', collection: 'pricing' },
	});
}

function convertFaq(block, key, stopped) {
	const variation = block.variation ?? 'two-column';
	if (!['two-column', 'centered'].includes(variation)) return stopped(`unknown variation ${variation}`);
	return convertSharedContent(block, key, stopped, {
		type: 'faq', variant: variation, headingRendered: true, subheadingRendered: true,
		inline: { field: 'items', label: 'questions', collection: 'faqs' },
	});
}

function convertTeam(block, key, stopped) {
	return convertSharedContent(block, key, stopped, {
		type: 'team', variant: 'four-column', headingRendered: true, subheadingRendered: true,
		inline: { field: 'members', label: 'members', collection: 'team' },
	});
}

function convertDocument(block, key, stopped) {
	const heading = block.headline;
	if (!isSet(heading)) return stopped('document requires a headline for the prose heading');
	if (!isSet(block.content)) return stopped('document content is empty');
	let content;
	try {
		content = htmlToPortableText(block.content, key);
	} catch (error) {
		return stopped(error.message);
	}
	if (!content.length) return stopped('document content is empty');
	return {
		block: {
			_type: 'prose', _key: key, _version: 1, variant: 'centered',
			heading, body: block.subheadline ?? '', content,
		},
	};
}

const HEADING_STYLES = { p: 'normal', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', blockquote: 'blockquote' };
const INLINE_MARKS = { strong: 'strong', b: 'strong', em: 'em', i: 'em', code: 'code' };

/**
 * Convert the HTML subset the marketing document field holds (paragraphs,
 * headings, lists, emphasis, links, hard breaks, quotes) into Portable Text
 * blocks with deterministic keys. Anything else throws naming the element,
 * so a document can never silently lose markup.
 */
export function htmlToPortableText(html, keyPrefix) {
	const parser = new HtmlParser(tokenizeHtml(html), keyPrefix);
	return parser.parseDocument();
}

function tokenizeHtml(html) {
	const tokens = [];
	const pattern = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>|([^<]+)/g;
	for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
		if (match[5] !== undefined) {
			if (match[5].trim()) tokens.push({ kind: 'text', text: collapseSpace(match[5]) });
			else tokens.push({ kind: 'text', text: ' ' });
		} else if (!match[1]) {
			tokens.push({ kind: 'open', name: match[2].toLowerCase(), attrs: parseAttrs(match[3]), selfClosing: Boolean(match[4]) });
		} else {
			tokens.push({ kind: 'close', name: match[2].toLowerCase() });
		}
	}
	return tokens;
}

function collapseSpace(text) {
	return text.replace(/\s+/g, ' ');
}

function parseAttrs(source) {
	const attrs = {};
	const pattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
	for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
		attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? '';
	}
	return attrs;
}

class HtmlParser {
	constructor(tokens, keyPrefix) {
		this.tokens = tokens;
		this.position = 0;
		this.keyPrefix = keyPrefix;
		this.blockIndex = 0;
		this.linkIndex = 0;
		this.listIndex = 0;
		this.pendingMarkDefs = [];
	}

	parseDocument() {
		const blocks = [];
		let straySpans = null;
		while (this.position < this.tokens.length) {
			const token = this.tokens[this.position];
			if (token.kind === 'close') throw new Error(`Unexpected closing tag </${token.name}>`);
			if (token.kind === 'text') {
				// Whitespace between blocks carries no content; inside a block it does.
				if (token.text.trim()) straySpans ??= [];
				if (straySpans) this.pushText(straySpans, token.text, []);
				this.position += 1;
				continue;
			}
			const { name } = token;
			if (HEADING_STYLES[name]) {
				straySpans = this.flushStray(blocks, straySpans);
				blocks.push(this.parseStyledBlock(name));
			} else if (name === 'ul' || name === 'ol') {
				straySpans = this.flushStray(blocks, straySpans);
				this.parseList(name, 1, blocks);
			} else if (INLINE_MARKS[name] || name === 'a' || name === 'br') {
				straySpans ??= [];
				this.parseInline(token, straySpans, []);
			} else if (name === 'li') {
				throw new Error('<li> outside a list');
			} else {
				throw new Error(`Unsupported HTML element <${name}>`);
			}
		}
		this.flushStray(blocks, straySpans);
		return blocks;
	}

	flushStray(blocks, spans) {
		// Text the old editor let sit between blocks keeps its own paragraph.
		if (spans?.length) blocks.push(this.makeBlock('normal', spans));
		return null;
	}

	parseStyledBlock(tag) {
		this.position += 1;
		const spans = this.parseInlineUntil(tag, []);
		return this.makeBlock(HEADING_STYLES[tag], spans);
	}

	parseList(tag, level, blocks) {
		const ordered = tag === 'ol';
		const listId = ordered ? `${this.keyPrefix}-ol-${this.listIndex++}` : undefined;
		this.position += 1;
		let sawItem = false;
		while (this.position < this.tokens.length) {
			const token = this.tokens[this.position];
			if (token.kind === 'close') {
				if (token.name !== tag) throw new Error(`Expected </${tag}>, found </${token.name}>`);
				this.position += 1;
				if (!sawItem) throw new Error(`Empty <${tag}> list`);
				return;
			}
			if (token.kind !== 'open' || token.name !== 'li') throw new Error(`Expected <li> in <${tag}>, found ${describe(token)}`);
			sawItem = true;
			this.position += 1;
			this.parseListItem(tag, level, blocks, ordered, listId);
		}
		throw new Error(`Unterminated <${tag}> list`);
	}

	parseListItem(listTag, level, blocks, ordered, listId) {
		const spans = [];
		const nested = [];
		while (this.position < this.tokens.length) {
			const token = this.tokens[this.position];
			if (token.kind === 'close') {
				if (token.name === 'li') {
					this.position += 1;
					blocks.push(this.makeBlock('normal', spans, { listItem: ordered ? 'number' : 'bullet', level, ...(listId ? { listId } : {}) }));
					blocks.push(...nested);
					return;
				}
				throw new Error(`Expected </li>, found </${token.name}>`);
			}
			if (token.kind === 'open' && (token.name === 'ul' || token.name === 'ol')) {
				this.parseList(token.name, level + 1, nested);
				continue;
			}
			if (token.kind === 'open' && HEADING_STYLES[token.name] && token.name !== 'p') {
				throw new Error(`Unsupported HTML element <${token.name}> inside a list item`);
			}
			this.parseInline(token, spans, []);
		}
		throw new Error('Unterminated <li>');
	}

	/** Parse one inline token (text, emphasis, link or break) into `spans`,
	 * carrying the enclosing marks. Nested emphasis stacks. */
	parseInline(token, spans, marks) {
		if (token.kind === 'text') {
			this.pushText(spans, token.text, marks);
			this.position += 1;
			return;
		}
		if (token.kind === 'close') throw new Error(`Unexpected closing tag </${token.name}>`);
		const { name } = token;
		if (name === 'br') {
			this.appendBreak(spans);
			this.position += 1;
			return;
		}
		if (INLINE_MARKS[name]) {
			this.position += 1;
			this.parseInlineUntil(name, [...marks, INLINE_MARKS[name]], spans);
			return;
		}
		if (name === 'a') {
			if (!isSet(token.attrs.href)) throw new Error('<a> without an href');
			const markKey = `${this.keyPrefix}-link-${this.linkIndex++}`;
			this.position += 1;
			// The mark definition belongs to the finished block; the spans
			// carry the key now and makeBlock attaches markDefs.
			this.parseInlineUntil(name, [...marks, markKey], spans);
			this.pendingMarkDefs.push({ _key: markKey, _type: 'link', href: token.attrs.href });
			return;
		}
		throw new Error(`Unsupported HTML element <${name}>`);
	}

	parseInlineUntil(closingName, marks, spans = []) {
		while (this.position < this.tokens.length) {
			const token = this.tokens[this.position];
			if (token.kind === 'close') {
				if (token.name !== closingName) throw new Error(`Expected </${closingName}>, found </${token.name}>`);
				this.position += 1;
			return spans;
			}
			this.parseInline(token, spans, marks);
		}
		throw new Error(`Unterminated <${closingName}>`);
	}

	appendBreak(spans) {
		if (!spans.length) return;
		const last = spans[spans.length - 1];
		last.text = `${last.text}\n`;
	}

	pushText(spans, text, marks) {
		if (!text) return;
		const previous = spans[spans.length - 1];
		if (previous && sameMarks(previous.marks, marks)) previous.text += text;
		else spans.push({ text, marks: [...marks] });
	}

	makeBlock(style, spans, listProps = {}) {
		const key = `${this.keyPrefix}-${this.blockIndex++}`;
		trimSpans(spans);
		const markDefs = this.pendingMarkDefs;
		this.pendingMarkDefs = [];
		return {
			_type: 'block', _key: key, style,
			children: spans.map((span, index) => ({
				_type: 'span', _key: `${key}-${index}`, text: span.text, marks: span.marks,
			})),
			...(markDefs.length ? { markDefs } : {}),
			...(Object.keys(listProps).length ? listProps : {}),
		};
	}
}

function describe(token) {
	return token.kind === 'text' ? `text "${token.text}"` : `<${token.name}>`;
}

function sameMarks(a, b) {
	return (a ?? []).length === (b ?? []).length && (a ?? []).every((mark, index) => mark === b[index]);
}

function trimSpans(spans) {
	if (!spans.length) return;
	const first = spans[0];
	first.text = first.text.replace(/^ +/, '');
	const last = spans[spans.length - 1];
	last.text = last.text.replace(/ +$/, '');
	if (!last.text) spans.pop();
	if (!spans.length || !spans[0].text) spans.shift();
}

/** Guard the destination the way the home script did: tokens never leave HTTPS. */
function guardDestination(site, token) {
	const base = new URL(site);
	if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Expected an HTTP(S) site URL without embedded credentials');
	const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
	if (base.protocol !== 'https:' && !loopback) throw new Error('HTTPS is required for non-local token requests');
	if (!token) throw new Error('EMDASH_TOKEN is required');
	return base;
}

/** Plan by default; callers can inject HTTP without a site or credentials. */
export async function migratePages({ site, token, apply = false, page, http = fetch }) {
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
	if (page) {
		const current = await request(`/_emdash/api/content/pages/${encodeURIComponent(page)}`);
		refs.push(current.item);
	} else {
		let cursor;
		do {
			const query = new URLSearchParams({ status: 'all', limit: '100' });
			if (cursor) query.set('cursor', cursor);
			const list = await request(`/_emdash/api/content/pages?${query}`);
			if (!Array.isArray(list.items)) throw new Error('pages list response has no items');
			refs.push(...list.items);
			cursor = list.nextCursor;
		} while (cursor);
	}

	const serviceCache = new Map();
	const resolveService = async (slug) => {
		if (!serviceCache.has(slug)) {
			const result = await request(`/_emdash/api/content/services/${encodeURIComponent(slug)}`);
			const id = result.item?.data?.id;
			if (!id) throw new Error(`service "${slug}" not found`);
			serviceCache.set(slug, id);
		}
		return serviceCache.get(slug);
	};

	const pages = [];
	const errors = [];
	for (const ref of refs) {
		const entry = await planPage(ref, { request, resolveService });
		pages.push(entry.page);
		if (entry.error) errors.push(entry.error);
	}
	const summary = {
		pages: pages.length,
		moves: pages.reduce((count, page) => count + ((page.moves ?? []).length), 0),
		unchanged: pages.filter((page) => page.action === 'unchanged').length,
		stopped: pages.filter((page) => page.action === 'stopped').length,
		failed: pages.filter((page) => page.error).length,
	};
	return {
		site: base.origin, collection: 'pages', applied: apply && !errors.length,
		...(errors.length ? { errors } : {}), pages, summary,
	};

	async function planPage(ref, { request, resolveService }) {
		const current = await request(`/_emdash/api/content/pages/${encodeURIComponent(ref.id)}`);
		const item = current.item;
		if (!item || item.id !== ref.id) throw new Error(`Expected page ${ref.id}`);
		const page = { id: item.id, slug: item.slug, status: item.status, revision: current._rev };
		try {
			const plan = await convertPage(item.data ?? {}, { resolveService });
			if (plan === null) return { page: { ...page, action: 'unchanged', applied: false } };
			if (plan.stopped) return { page: { ...page, action: 'stopped', applied: false, stopReason: plan.stopped } };
			Object.assign(page, {
				action: 'move-content-to-layout', applied: false,
				moves: plan.moves, skipped: plan.skipped ?? [],
				...(plan.service !== undefined ? { service: plan.service } : {}),
			});
			if (!apply) return { page };
			try {
				await applyPage(page, item, current, plan, { request });
			} catch (error) {
				Object.assign(page, { applied: false, error: { message: error.message, operation: error.operation, status: error.status, code: error.code } });
				return {
					page,
					error: { message: error.message, operation: error.operation, status: error.status, code: error.code, page: item.slug },
				};
			}
			return { page };
		} catch (error) {
			return {
				page: { ...page, action: 'move-content-to-layout', applied: false, error: { message: error.message, operation: error.operation, status: error.status, code: error.code } },
				error: { message: error.message, operation: error.operation, status: error.status, code: error.code, page: item.slug },
			};
		}
	}

	async function applyPage(page, item, current, plan, { request }) {
		if (!current._rev) throw new Error(`page ${item.slug} response has no _rev; refusing an unguarded write`);
		const path = `/_emdash/api/content/pages/${encodeURIComponent(item.id)}`;
		const data = { ...item.data, layout: plan.layout };
		if (plan.service !== undefined) data.service = plan.service;
		await request(path, 'PUT', { data, _rev: current._rev });
		const verified = await request(path);
		if (!isDeepStrictEqual(verified.item.data.layout, plan.layout)) {
			throw new Error(`page ${item.slug} read-back layout did not match the migration write`);
		}
		if (!isDeepStrictEqual(verified.item.data.content ?? [], item.data.content ?? [])) {
			throw new Error(`page ${item.slug} read-back content changed`);
		}
		if (plan.service !== undefined && verified.item.data.service !== plan.service) {
			throw new Error(`page ${item.slug} read-back service did not match the migration write`);
		}
		page.applied = true;
		page.revision = verified._rev;
		// A published page gets a draft from the PUT; publish it through the API
		// so the page builder's publish policy runs. A draft stays a draft.
		if (item.status === 'published') {
			await request(`${path}/publish`, 'POST', { _rev: verified._rev });
			const final = await request(path);
			if (final.item.status !== 'published' || final.item.draftRevisionId) {
				throw new Error(`page ${item.slug} did not end published without a pending draft`);
			}
			if (!isDeepStrictEqual(final.item.data.layout, plan.layout)) {
				throw new Error(`page ${item.slug} published layout did not match the migration write`);
			}
			page.revision = final._rev;
			page.published = true;
		}
	}
}

export async function main(argv, { token = process.env.EMDASH_TOKEN, http = fetch, out = console.log } = {}) {
	try {
		const { values, positionals } = parseArgs({
			args: argv, allowPositionals: true,
			options: {
				apply: { type: 'boolean' },
				page: { type: 'string' },
				table: { type: 'boolean' },
			},
		});
		if (positionals.length !== 1) throw new Error('usage: node scripts/move-content-to-layout.mjs <site-url> [--apply] [--page <slug>] [--table]');
		const result = await migratePages({ site: positionals[0], token, http, apply: values.apply, page: values.page });
		if (values.table) {
			out([
				`site         ${result.site}`,
				`collection   ${result.collection}`,
				`applied      ${result.applied}`,
				...result.pages.map((page) => [
					`${(page.slug ?? '').padEnd(20)} ${(page.status ?? '').padEnd(10)} ${page.action}`,
					...(page.moves ?? []).map((move) => `  ${move.from} -> ${move.to} (${move.key})`),
					...(page.stopReason ?? []).map((reason) => `  stopped: ${reason}`),
					...(page.skipped ?? []).map((skip) => `  skipped ${skip.block}.${skip.field}: ${skip.reason}`),
					...(page.error ? [`  error: ${page.error.message}`] : []),
				].join('\n')),
			].join('\n'));
		} else {
			out(JSON.stringify(result, null, 2));
		}
		return result.errors?.length ? 1 : 0;
	} catch (error) {
		out(JSON.stringify({ errors: [{ message: error.message, operation: error.operation, status: error.status, code: error.code }] }, null, 2));
		return 1;
	}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
