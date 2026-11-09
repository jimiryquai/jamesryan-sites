import assert from "node:assert/strict";
import { mock, test } from "node:test";

const entries = {
	pages: [
		{ id: "home", status: "published", data: { title: "Home" } },
		{ id: "about", status: "published", data: { title: "About" } },
		{ id: "contact", status: "published", data: { title: "Contact" } },
		{ id: "privacy-policy", status: "published", data: { title: "Privacy" } },
		{ id: "custom", status: "published", data: { title: "Custom" } },
		{ id: "draft", status: "draft", data: { title: "Secret draft" } },
	],
	posts: Array.from({ length: 101 }, (_, index) => ({
		id: `post-${index + 1}`,
		status: "published",
		data: { title: `Post ${index + 1}`, excerpt: "An excerpt" },
	})),
};

mock.module("emdash", {
	namedExports: {
		async getSiteSettingsWithCacheHint() {
			return { data: { title: "Example", tagline: "A test site" }, cacheHint: { tags: ["settings"] } };
		},
		async getEmDashCollection(collection, { status, limit, cursor }) {
			const matching = entries[collection].filter((entry) => !status || entry.status === status);
			const offset = Number(cursor || 0);
			const next = offset + limit;
			return {
				entries: matching.slice(offset, next),
				nextCursor: next < matching.length ? String(next) : undefined,
				cacheHint: { tags: [collection] },
			};
		},
	},
});

const { getLlmsTxt } = await import("../src/llms.ts");

test("llms.txt lists published pages and every page of posts, not drafts", async () => {
	const hints = [];
	const response = await getLlmsTxt("https://staging.example", {
		enabled: true,
		set: (hint) => hints.push(...hint.tags),
	});
	const text = await response.text();

	assert.equal(response.status, 200);
	assert.match(response.headers.get("content-type"), /^text\/plain/);
	assert.match(text, /^# Example\n\n> A test site/m);
	assert.match(text, /\[Home\]\(https:\/\/staging\.example\/\)/);
	assert.match(text, /\[About\]\(https:\/\/staging\.example\/about\)/);
	assert.match(text, /\[Contact\]\(https:\/\/staging\.example\/contact\)/);
	assert.match(text, /\[Privacy\]\(https:\/\/staging\.example\/privacy-policy\)/);
	assert.match(text, /\[Custom\]\(https:\/\/staging\.example\/pages\/custom\)/);
	assert.match(text, /\[Post 101\]\(https:\/\/staging\.example\/posts\/post-101\): An excerpt/);
	assert.doesNotMatch(text, /Secret draft|\/pages\/draft/);
	assert.deepEqual(new Set(hints), new Set(["settings", "pages", "posts"]));
});
