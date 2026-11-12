import assert from "node:assert/strict";
import { mock, test } from "node:test";

const entry = (id, data = {}) => ({
	id,
	data: { status: "published", title: `Title of ${id}`, ...data },
});
const records = {
	pages: [entry("home"), entry("about"), entry("draft-page", { status: "draft" })],
	posts: [entry("fixture-post", { excerpt: "Post excerpt" }), entry("draft-post", { status: "draft" })],
	projects: [entry("fixture-project", { summary: "Project summary" })],
};
let requestContext;
let settings = { title: "Configured Site", tagline: "Configured tagline" };
const queries = [];
const rendered = [];

class FakeImageResponse extends Response {
	constructor(element, options) {
		rendered.push({ element, options });
		super("png-bytes", { headers: { "Content-Type": "image/png", ...options?.headers } });
	}
}
mock.module("emdash", { namedExports: {
	async getEmDashEntry(collection, slug) {
		assert.ok(typeof collection === "string" && Object.hasOwn(records, collection),
			`mock: getEmDashEntry received a non-collection ${String(collection)}`);
		queries.push({ kind: "entry", collection, slug });
		return { entry: records[collection].find((e) => e.id === slug) ?? null, cacheHint: { tags: [collection] } };
	},
	async getSiteSettingsWithCacheHint() {
		queries.push({ kind: "settings" });
		return { data: settings, cacheHint: { tags: ["settings"] } };
	},
	getRequestContext: () => requestContext,
} });
mock.module("workers-og", { namedExports: { ImageResponse: FakeImageResponse } });
const { getOgEntryImage, getOgSiteImage, ogFontData } = await import("../src/og.ts");

const options = { defaultTitle: "James Ryan", socialBackground: "linear-gradient(135deg, #21221b 0%, #3e4034 50%, #5b5e4c 100%)" };
const request = (slug, overrides = {}) => ({
	params: { slug },
	url: new URL(slug ? `https://example.com/og/${slug}.png` : "https://example.com/og/default.png"),
	cache: { enabled: true, set: () => {} },
	...overrides,
});

/** Every text string in the VNode tree, in document order. */
const textOf = (node) => {
	if (typeof node === "string") return [node];
	const children = node.props?.children;
	if (!children) return [];
	return Array.isArray(children) ? children.flatMap(textOf) : textOf(children);
};
/** Every element node matching a predicate, including the root. */
const nodesWith = (node, predicate) => {
	if (!node || typeof node !== "object") return [];
	const self = predicate(node) ? [node] : [];
	const children = node.props?.children;
	const below = Array.isArray(children)
		? children.flatMap((child) => nodesWith(child, predicate))
		: typeof children === "object" && children
			? nodesWith(children, predicate)
			: [];
	return [...self, ...below];
};
const texts = (element) => textOf(element).join(" ");
const hasFontSize = (element, fontSize) =>
	nodesWith(element, (node) => node.props?.style?.fontSize === fontSize);

test("og prefixes map to their collections and render the entry card", async () => {
	for (const [slug, collection, subtitle] of [["posts/fixture-post", "posts", "Post excerpt"], ["projects/fixture-project", "projects", "Project summary"], ["pages/home", "pages", undefined]]) {
		rendered.length = 0;
		const response = await getOgEntryImage(request(slug), options);
		assert.equal(response.status, 200, slug);
		assert.equal(response.headers.get("Content-Type"), "image/png", slug);
		assert.ok(queries.some((q) => q.kind === "entry" && q.collection === collection), slug);
		const { element } = rendered[0];
		const cardText = texts(element);
		assert.ok(cardText.includes(`Title of ${slug.split("/")[1]}`), slug);
		assert.ok(cardText.includes("Configured Site"), slug);
		const [root] = nodesWith(element, (node) => node.props?.style?.width === 1200);
		assert.equal(root?.props?.style?.backgroundImage, options.socialBackground, slug);
		const [footer] = nodesWith(element, (node) => node.props?.style?.borderTop === "1px solid rgba(255, 255, 255, 0.25)");
		if (subtitle) {
			const [subtitleNode] = hasFontSize(element, 24);
			assert.ok(subtitleNode, `${slug}: subtitle node present`);
			assert.ok(texts(subtitleNode).includes(subtitle), slug);
			assert.equal(footer?.props?.style?.justifyContent, "space-between", slug);
		} else {
			assert.equal(hasFontSize(element, 24).length, 0, `${slug}: no subtitle node for a page`);
			assert.equal(footer?.props?.style?.justifyContent, "flex-end", slug);
		}
	}
});

test("unknown prefixes, prototype keys, missing slugs and missing entries return 404 without immutable caching", async () => {
	for (const slug of ["blog/fixture-post", "work/fixture-project", "tag/fixture-post", "fixture-post", "posts/", "posts/missing-post",
		"constructor/fixture-post", "toString/fixture-post", "__proto__/fixture-post"]) {
		queries.length = 0;
		const response = await getOgEntryImage(request(slug), options);
		assert.equal(response.status, 404, slug);
		const cacheControl = response.headers.get("Cache-Control");
		assert.ok(cacheControl && !cacheControl.includes("immutable"), slug);
		assert.ok(!queries.some((q) => q.kind === "settings"), `${slug}: no settings read before a 404`);
	}
});

test("anonymous requests never render drafts; published hits set the cache hint and a bounded revalidateable header", async () => {
	const hints = [];
	const draft = await getOgEntryImage(request("posts/draft-post", { cache: { enabled: true, set: (h) => hints.push(h) } }), options);
	assert.equal(draft.status, 404);
	const published = await getOgEntryImage(request("posts/fixture-post", { cache: { enabled: true, set: (h) => hints.push(h) } }), options);
	assert.equal(published.status, 200);
	const cacheControl = published.headers.get("Cache-Control");
	assert.ok(cacheControl?.includes("max-age=3600"), cacheControl);
	assert.ok(cacheControl?.includes("stale-while-revalidate"), cacheControl);
	assert.ok(!cacheControl?.includes("immutable"), cacheControl);
	assert.deepEqual(hints.map((h) => h.tags).flat(2).sort(), ["posts", "settings"]);
});

test("preview and edit sessions render drafts with private, no-store and no route cache", async () => {
	for (const context of [{ editMode: true }, { editMode: false, preview: { collection: "posts", id: "draft-post" } }]) {
		const sets = [];
		requestContext = context;
		try {
			const response = await getOgEntryImage(request("posts/draft-post", { cache: { enabled: true, set: (s) => sets.push(s) } }), options);
			assert.equal(response.status, 200);
			assert.equal(response.headers.get("Cache-Control"), "private, no-store");
			assert.deepEqual(sets, [false]);
		} finally {
			requestContext = undefined;
		}
	}
});

test("titles, subtitles and hosts render as exact glyphs with no injected elements", async () => {
	records.posts.push(entry("punctuated-post", { title: `R&D <b>bold</b> "quotes" 'single'`, excerpt: "A & B <i>italic</i>" }));
	try {
		rendered.length = 0;
		const response = await getOgEntryImage(request("posts/punctuated-post"), options);
		assert.equal(response.status, 200);
		const { element } = rendered[0];
		const cardText = texts(element);
		assert.ok(cardText.includes(`R&D <b>bold</b> "quotes" 'single'`), cardText);
		assert.ok(cardText.includes("A & B <i>italic</i>"), cardText);
		assert.ok(cardText.includes("example.com"), cardText);
		assert.ok(!cardText.includes("&amp;") && !cardText.includes("&lt;") && !cardText.includes("&quot;"), cardText);
		assert.equal(nodesWith(element, (node) => node.type === "b" || node.type === "i").length, 0, "no injected markup elements");
	} finally {
		records.posts.pop();
	}
});

test("bundled fonts decode to WOFF1 bytes without any runtime fetch", () => {
	for (const font of ogFontData()) {
		assert.equal(font.name, "Inter");
		assert.equal(new Uint8Array(font.data, 0, 4).toString(), "119,79,70,70", `${font.weight}: WOFF magic bytes`);
	}
	assert.deepEqual(ogFontData().map((f) => f.weight).sort(), [400, 600, 700]);
});

test("the site card renders configured identity and sets the settings cache hint", async () => {
	rendered.length = 0;
	const hints = [];
	const response = await getOgSiteImage(request(undefined, { cache: { enabled: true, set: (h) => hints.push(h) } }), options);
	assert.equal(response.status, 200);
	const { element } = rendered[0];
	const cardText = texts(element);
	assert.ok(cardText.includes("Configured Site"), "site title rendered");
	assert.ok(cardText.includes("Configured tagline"), "tagline rendered as the card description");
	assert.ok(cardText.includes("example.com"));
	const [root] = nodesWith(element, (node) => node.props?.style?.width === 1200);
	assert.equal(root?.props?.style?.backgroundImage, options.socialBackground);
	const [descriptionNode] = hasFontSize(element, 60);
	assert.ok(descriptionNode && texts(descriptionNode).includes("Configured tagline"), "60px description node present");
	assert.ok(hints.map((h) => h.tags).flat(2).includes("settings"));
	assert.ok(!response.headers.get("Cache-Control").includes("immutable"));
});

test("the site card falls back to app defaults and omits the description cleanly when empty", async () => {
	const previous = settings;
	settings = {};
	try {
		rendered.length = 0;
		const response = await getOgSiteImage(request(undefined), options);
		assert.equal(response.status, 200);
		const { element } = rendered[0];
		const cardText = texts(element);
		assert.ok(cardText.includes("James Ryan"), "default title used when settings are unset");
		assert.equal(hasFontSize(element, 60).length, 0, "no description node when no tagline and no default");
	} finally {
		settings = previous;
	}
});
