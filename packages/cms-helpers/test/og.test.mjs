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
		queries.push({ kind: "entry", collection, slug });
		return { entry: records[collection]?.find((e) => e.id === slug) ?? null, cacheHint: { tags: [collection] } };
	},
	async getSiteSettingsWithCacheHint() {
		queries.push({ kind: "settings" });
		return { data: settings, cacheHint: { tags: ["settings"] } };
	},
	getRequestContext: () => requestContext,
} });
mock.module("workers-og", { namedExports: { ImageResponse: FakeImageResponse } });
const { escapeHtml, getOgEntryImage, getOgSiteImage, ogFontData } = await import("../src/og.ts");

const options = { defaultTitle: "James Ryan", defaultDescription: "", socialBackground: "linear-gradient(135deg, #21221b 0%, #3e4034 50%, #5b5e4c 100%)" };
const request = (slug, overrides = {}) => ({
	params: { slug },
	url: new URL(slug ? `https://example.com/og/${slug}.png` : "https://example.com/og/default.png"),
	cache: { enabled: true, set: () => {} },
	...overrides,
});

test("escapeHtml neutralizes markup-significant characters", () => {
	assert.equal(escapeHtml(`C# & .NET <tag> "quoted" 'single'`), "C# &amp; .NET &lt;tag&gt; &quot;quoted&quot; &#39;single&#39;");
});

test("og prefixes map to their collections and render the entry card", async () => {
	for (const [slug, collection, subtitle] of [["posts/fixture-post", "posts", "Post excerpt"], ["projects/fixture-project", "projects", "Project summary"], ["pages/home", "pages", undefined]]) {
		rendered.length = 0;
		const response = await getOgEntryImage(request(slug), options);
		assert.equal(response.status, 200, slug);
		assert.equal(response.headers.get("Content-Type"), "image/png", slug);
		assert.ok(queries.some((q) => q.kind === "entry" && q.collection === collection), slug);
		const { element } = rendered[0];
		assert.ok(element.includes(`Title of ${slug.split("/")[1]}`), slug);
		if (subtitle) assert.ok(element.includes(subtitle), slug);
		else assert.ok(!element.includes("font-size:24px"), `${slug}: no subtitle row for a page`);
		assert.ok(element.includes("Configured Site"), slug);
		assert.ok(element.includes(options.socialBackground), slug);
	}
});

test("unknown prefixes, missing slugs and missing entries return 404 without immutable caching", async () => {
	for (const slug of ["blog/fixture-post", "work/fixture-project", "tag/fixture-post", "fixture-post", "posts/", "posts/missing-post"]) {
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

test("titles, subtitles and hosts are HTML-escaped in the card", async () => {
	records.posts.push(entry("escaped-post", { title: `R&D <b>bold</b> "quotes"`, excerpt: "A & B <i>italic</i>" }));
	try {
		rendered.length = 0;
		const response = await getOgEntryImage(request("posts/escaped-post"), options);
		assert.equal(response.status, 200);
		const { element } = rendered[0];
		assert.ok(element.includes("R&amp;D &lt;b&gt;bold&lt;/b&gt; &quot;quotes&quot;"), element);
		assert.ok(element.includes("A &amp; B &lt;i&gt;italic&lt;/i&gt;"), element);
		assert.ok(element.includes("example.com"), element);
		assert.ok(!element.includes("<b>bold</b>"), element);
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
	assert.ok(element.includes("Configured Site"), "site title rendered");
	assert.ok(element.includes("Configured tagline"), "tagline rendered as the card description");
	assert.ok(element.includes(options.socialBackground));
	assert.ok(element.includes("example.com"));
	assert.ok(hints.map((h) => h.tags).flat(2).includes("settings"));
	assert.ok(!response.headers.get("Cache-Control").includes("immutable"));
});

test("the site card falls back to app defaults and omits the description cleanly when empty", async () => {
	const previous = settings;
	settings = {};
	try {
		rendered.length = 0;
		const response = await getOgSiteImage(request(undefined), { ...options, defaultDescription: "" });
		assert.equal(response.status, 200);
		const { element } = rendered[0];
		assert.ok(element.includes("James Ryan"), "default title used when settings are unset");
		assert.ok(!element.includes("font-size:60px"), "no description block when no tagline and no default");
	} finally {
		settings = previous;
	}
});
