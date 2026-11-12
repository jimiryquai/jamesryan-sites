import { getEmDashEntry, getSiteSettingsWithCacheHint, getRequestContext, type CacheHint } from "emdash";
import { interLatinWoff } from "./og-fonts.ts";
import type { PublicCollection } from "./public-collections.ts";
import { ImageResponse } from "workers-og";

/**
 * The one OpenGraph image builder for both apps (docs/published-routes.md
 * owns the URL rule): `/og/posts/<slug>.png`, `/og/projects/<slug>.png`,
 * `/og/pages/<slug>.png` and `/og/default.png`, rendered by workers-og from
 * bundled Inter bytes — zero outbound requests at render time.
 */

/** `packages/ui` Base.astro emits exactly these prefixes for these collections. */
const OG_COLLECTIONS: Record<string, PublicCollection> = { posts: "posts", projects: "projects", pages: "pages" };

const NOT_FOUND_CACHE_CONTROL = "public, max-age=60";
const PUBLIC_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const SESSION_CACHE_CONTROL = "private, no-store";

export interface OgSiteOptions {
	/** Site title when the CMS settings are unset, e.g. "James Ryan" or "Digital Garden". */
	defaultTitle: string;
	/** Site description when the settings tagline is unset; "" omits the description cleanly. */
	defaultDescription: string;
	/** Satori `background-image` value — the olive social gradient from the shared palette. */
	socialBackground: string;
}

/** The slice of Astro's APIRoute context the OG handlers read. */
export interface OgRequestContext {
	params: { slug?: string };
	url: URL;
	cache?: { enabled: boolean; set: (hint: CacheHint | false) => void } | null;
}

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

let cachedFontData: Array<{ name: string; data: ArrayBuffer; weight: number; style: "normal" }> | undefined;

/** Inter latin WOFF1 bytes embedded in the bundle, decoded once per isolate. */
export function ogFontData() {
	if (!cachedFontData) {
		cachedFontData = Object.entries(interLatinWoff).map(([weight, base64]) => ({
			name: "Inter",
			data: base64ToArrayBuffer(base64),
			weight: Number(weight),
			style: "normal" as const,
		}));
	}
	return cachedFontData;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes.buffer;
}

function isSessionRender(): boolean {
	// Verified previews and edit mode may render drafts; the response is
	// session-specific and must never reach a shared cache. Same rule as the
	// markdown twins (see apps/marketing-site/src/utils/content-markdown.ts).
	const context = getRequestContext();
	return context?.editMode === true || context?.preview !== undefined;
}

async function siteIdentity(options: OgSiteOptions): Promise<{ title: string; description: string; cacheHint: CacheHint }> {
	const { data, cacheHint } = await getSiteSettingsWithCacheHint();
	return {
		title: data.title || options.defaultTitle,
		description: data.tagline || options.defaultDescription,
		cacheHint,
	};
}

function ogImage(html: string, sessionRender: boolean): ImageResponse {
	return new ImageResponse(html, {
		width: 1200,
		height: 630,
		fonts: ogFontData(),
		headers: {
			"Cache-Control": sessionRender ? SESSION_CACHE_CONTROL : PUBLIC_CACHE_CONTROL,
		},
	});
}

function notFound(): Response {
	return new Response("Not found", {
		status: 404,
		headers: { "Cache-Control": NOT_FOUND_CACHE_CONTROL },
	});
}

function cardShell(options: OgSiteOptions, body: string, footer: { content: string; spread: boolean }): string {
	// Compact markup, and display:flex on every div: satori counts whitespace
	// text nodes between tags as children, and workers-og's parser wraps even a
	// single text child in an array — so any div without display:flex throws.
	return (
		`<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-image: ${options.socialBackground}; color: #ffffff; padding: 70px 90px; justify-content: space-between; font-family: 'Inter', sans-serif;">` +
		body +
		`<div style="display: flex; flex-direction: row; justify-content: ${footer.spread ? "space-between" : "flex-end"}; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.25); padding-top: 35px; margin-top: auto;">` +
		footer.content +
		"</div></div>"
	);
}

function hostBadge(url: URL): string {
	return `<div style="display: flex; font-size: 20px; font-weight: 600; background: rgba(255, 255, 255, 0.18); padding: 12px 28px; border-radius: 100px; border: 1px solid rgba(255, 255, 255, 0.1);">${escapeHtml(url.host)}</div>`;
}

/** `/og/<collection>/<slug>.png`: the entry's title and excerpt/summary. */
export async function getOgEntryImage(request: OgRequestContext, options: OgSiteOptions): Promise<Response> {
	const slug = request.params.slug ?? "";
	const separator = slug.indexOf("/");
	if (separator <= 0) return notFound();
	const collection = OG_COLLECTIONS[slug.slice(0, separator)];
	const entryId = slug.slice(separator + 1);
	if (!collection || !entryId) return notFound();

	const result = await getEmDashEntry(collection, entryId);
	if (result.error) throw result.error;
	const entry = result.entry;
	const sessionRender = isSessionRender();
	if (!entry || (!sessionRender && entry.data.status !== "published")) return notFound();

	const identity = await siteIdentity(options);
	if (sessionRender) request.cache?.set(false);
	else if (request.cache?.enabled) {
		request.cache.set(result.cacheHint);
		request.cache.set(identity.cacheHint);
	}

	const title = entry.data.title || identity.title;
	const subtitle: string = entry.data.excerpt || entry.data.summary || "";
	const footer = subtitle
		? {
				content: `<div style="display: flex; font-size: 24px; opacity: 0.85; font-weight: 400; max-width: 800px; white-space: nowrap; overflow: hidden;">${escapeHtml(subtitle)}</div>${hostBadge(request.url)}`,
				spread: true,
			}
		: { content: hostBadge(request.url), spread: false };
	const html = cardShell(
		options,
		`<div style="display: flex; flex-direction: column;"><div style="display: flex; font-size: 26px; font-weight: 600; opacity: 0.95; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2.5px;">${escapeHtml(identity.title)}</div><div style="display: flex; flex-direction: column; font-size: 60px; font-weight: 700; line-height: 1.25; max-height: 310px; overflow: hidden;">${escapeHtml(title)}</div></div>`,
		footer,
	);
	return ogImage(html, sessionRender);
}

/** `/og/default.png`: the site card — settings identity, never invented copy. */
export async function getOgSiteImage(request: Omit<OgRequestContext, "params">, options: OgSiteOptions): Promise<Response> {
	const identity = await siteIdentity(options);
	const sessionRender = isSessionRender();
	if (sessionRender) request.cache?.set(false);
	else if (request.cache?.enabled) request.cache.set(identity.cacheHint);

	const description = identity.description
		? `<div style="display: flex; flex-direction: column; font-size: 60px; font-weight: 700; line-height: 1.3; margin-bottom: 24px;">${escapeHtml(identity.description)}</div>`
		: "";
	const html = cardShell(
		options,
		`<div style="display: flex; flex-direction: column; justify-content: center; height: 100%;"><div style="display: flex; font-size: 32px; font-weight: 600; opacity: 0.95; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 2.5px;">${escapeHtml(identity.title)}</div>${description}</div>`,
		{ content: hostBadge(request.url), spread: false },
	);
	return ogImage(html, sessionRender);
}
