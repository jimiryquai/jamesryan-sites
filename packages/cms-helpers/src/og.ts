import { getEmDashEntry, getSiteSettingsWithCacheHint, getRequestContext, type CacheHint } from "emdash";
import { resolveSiteIdentity } from "./site-identity.ts";
import { interLatinWoff } from "./og-fonts.ts";
import { publicCollections } from "./public-collections.ts";
import { ImageResponse } from "workers-og";

/**
 * The one OpenGraph image builder for both apps (docs/published-routes.md
 * owns the URL rule): `/og/posts/<slug>.png`, `/og/projects/<slug>.png`,
 * `/og/pages/<slug>.png` and `/og/default.png`, rendered by workers-og from
 * bundled Inter bytes — zero outbound requests at render time.
 *
 * Cards are Satori VNodes, not HTML strings: workers-og's HTMLRewriter path
 * does not decode entities (an escaped `&amp;` would render literally), while
 * a VNode hands plain JS strings straight to Satori — text children carry
 * exact glyphs with no parser and no injection surface.
 */

const NOT_FOUND_CACHE_CONTROL = "public, max-age=60";
const PUBLIC_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const SESSION_CACHE_CONTROL = "private, no-store";

export interface OgSiteOptions {
	/** Site title when the CMS settings are unset, e.g. "James Ryan" or "Digital Garden". */
	defaultTitle?: string;
	/** Site description when the settings tagline is unset; "" omits the description cleanly. */
	defaultDescription?: string;
	/** Satori `background-image` value — the olive social gradient from the shared palette. */
	socialBackground: string;
}

/** The slice of Astro's APIRoute context the OG handlers read. */
export interface OgRequestContext {
	params: { slug?: string };
	url: URL;
	cache?: { enabled: boolean; set: (hint: CacheHint | false) => void } | null;
}

/** A Satori element: camelCase `style` props, string or element children. */
type OgStyle = Record<string, string | number>;
type OgElement = Extract<ConstructorParameters<typeof ImageResponse>[0], { props: unknown }>;

/** Every div is display:flex: Satori requires it of any element whose children
 * are not a bare string, and consistent flex keeps the card layout explicit. */
function div(style: OgStyle, children: string | OgElement[]): OgElement {
	return { type: "div", props: { style: { display: "flex", ...style }, children } } as OgElement;
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
	const identity = resolveSiteIdentity(data);
	return {
		title: data.title || options.defaultTitle || identity.siteTitle,
		description: data.tagline || (options.defaultDescription ?? identity.siteTagline),
		cacheHint,
	};
}

function ogImage(element: OgElement, sessionRender: boolean): ImageResponse {
	return new ImageResponse(element, {
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

function hostBadge(host: string): OgElement {
	return div(
		{
			fontSize: 20,
			fontWeight: 600,
			background: "rgba(255, 255, 255, 0.18)",
			padding: "12px 28px",
			borderRadius: 100,
			border: "1px solid rgba(255, 255, 255, 0.1)",
		},
		host,
	);
}

function card(options: OgSiteOptions, body: OgElement, footer: { children: OgElement[]; spread: boolean }): OgElement {
	return div(
		{
			flexDirection: "column",
			width: 1200,
			height: 630,
			backgroundImage: options.socialBackground,
			color: "#ffffff",
			padding: "70px 90px",
			justifyContent: "space-between",
			fontFamily: "'Inter', sans-serif",
		},
		[
			body,
			div(
				{
					flexDirection: "row",
					justifyContent: footer.spread ? "space-between" : "flex-end",
					alignItems: "center",
					borderTop: "1px solid rgba(255, 255, 255, 0.25)",
					paddingTop: 35,
					marginTop: "auto",
				},
				footer.children,
			),
		],
	);
}

/** `/og/<collection>/<slug>.png`: the entry's title and excerpt/summary. */
export async function getOgEntryImage(request: OgRequestContext, options: OgSiteOptions): Promise<Response> {
	const slug = request.params.slug ?? "";
	const separator = slug.indexOf("/");
	if (separator <= 0) return notFound();
	// Resolve the prefix against the known collections (a plain-object map would
	// match prototype keys like "constructor" and 500 downstream).
	const collection = publicCollections.find((collection) => collection === slug.slice(0, separator));
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

	const title = typeof entry.data.title === "string" && entry.data.title ? entry.data.title : identity.title;
	const subtitle = typeof entry.data.excerpt === "string" && entry.data.excerpt
		? entry.data.excerpt : typeof entry.data.summary === "string" ? entry.data.summary : "";
	const footer = subtitle
		? {
				children: [
					div({ fontSize: 24, opacity: 0.85, fontWeight: 400, maxWidth: 800, whiteSpace: "nowrap", overflow: "hidden" }, subtitle),
					hostBadge(request.url.host),
				],
				spread: true,
			}
		: { children: [hostBadge(request.url.host)], spread: false };
	const element = card(
		options,
		div({ flexDirection: "column" }, [
			div(
				{ fontSize: 26, fontWeight: 600, opacity: 0.95, marginBottom: 24, textTransform: "uppercase", letterSpacing: 2.5 },
				identity.title,
			),
			div({ flexDirection: "column", fontSize: 60, fontWeight: 700, lineHeight: 1.25, maxHeight: 310, overflow: "hidden" }, title),
		]),
		footer,
	);
	return ogImage(element, sessionRender);
}

/** `/og/default.png`: the site card — settings identity, never invented copy. */
export async function getOgSiteImage(request: Omit<OgRequestContext, "params">, options: OgSiteOptions): Promise<Response> {
	const identity = await siteIdentity(options);
	const sessionRender = isSessionRender();
	if (sessionRender) request.cache?.set(false);
	else if (request.cache?.enabled) request.cache.set(identity.cacheHint);

	const description = identity.description
		? div({ flexDirection: "column", fontSize: 60, fontWeight: 700, lineHeight: 1.3, marginBottom: 24 }, identity.description)
		: null;
	const body = div({ flexDirection: "column", justifyContent: "center", height: "100%" }, [
		div({ fontSize: 32, fontWeight: 600, opacity: 0.95, marginBottom: 28, textTransform: "uppercase", letterSpacing: 2.5 }, identity.title),
		...(description ? [description] : []),
	]);
	const element = card(options, body, { children: [hostBadge(request.url.host)], spread: false });
	return ogImage(element, sessionRender);
}
