import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createRequire } from "node:module";
let context;
let onlyDrafts = false;
const records = [
  { id: "a post", data: { status: "published", title: "Published & public", publishedAt: new Date("2026-01-01"), updatedAt: new Date("2026-02-01") } },
  { id: "draft", data: { status: "draft", title: "Secret", publishedAt: new Date("2026-01-01") } },
];
const namedExports = {
  getRequestContext: () => context,
  async getSiteSettingsWithCacheHint() { return { data: { title: "Example", tagline: "Description" }, cacheHint: { tags: ["settings"] } }; },
  async getEmDashCollection(collection, options) {
    const entries = records.filter(entry => (!onlyDrafts || entry.data.status === "draft") && (!options.status || entry.data.status === options.status));
    return { entries: entries.slice(0, options.limit), cacheHint: { tags: [collection] } };
  },
  async getEmDashEntry() { throw new Error("Discovery must enumerate published entries"); },
  async getEmDashReferences() { throw new Error("Unexpected references query"); },
};
// pnpm installs a distinct EmDash peer context for the apps and helpers.
const emdashPaths = new Set([import.meta.resolve("emdash"), ...["marketing-site", "digital-garden"].map(app =>
  createRequire(new URL(`../../../apps/${app}/package.json`, import.meta.url)).resolve("emdash"))]);
for (const path of emdashPaths) mock.module(path, { namedExports });

for (const app of ["marketing-site", "digital-garden"]) {
  const { GET } = await import(`../../../apps/${app}/src/pages/rss.xml.ts`);
  test(`${app} RSS normalizes URLs, excludes drafts and propagates content and settings hints`, async () => {
    const hints = [];
    const response = await GET({ site: new URL("https://example.com///"), url: new URL("https://local.test/rss.xml"), cache: { enabled: true, set: hint => hints.push(hint) } });
    const text = await response.text();
    assert.match(text, /<link>https:\/\/example.com\/posts\/a%20post<\/link>/);
    assert.match(text, /href="https:\/\/example.com\/rss.xml"/);
    assert.match(text, /Published &amp; public/);
    assert.doesNotMatch(text, /Secret|\/\/posts|\/\/rss/);
    assert.deepEqual(hints, [{ tags: ["settings"] }, { tags: ["posts"] }]);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600");
  });
  test(`${app} RSS preview stays published-only and disables shared caching`, async () => {
    context = { preview: { id: "draft", collection: "posts" } };
    onlyDrafts = true;
    try {
      const hints = [];
      const response = await GET({ url: new URL("https://local.test/rss.xml"), cache: { enabled: true, set: hint => hints.push(hint) } });
      assert.doesNotMatch(await response.text(), /<item>|Secret/);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.ok(hints.includes(false));
    } finally { context = undefined; onlyDrafts = false; }
  });
}

const { getSchemaCollections } = await import("../src/schema-collections.ts");
test("schema discovery omits draft-only collections and propagates even empty-query hints", async () => {
  onlyDrafts = true;
  try {
    const hints = [];
    assert.deepEqual(await getSchemaCollections({ enabled: true, set: hint => hints.push(...hint.tags) }), []);
    assert.deepEqual(new Set(hints), new Set(["pages", "posts", "projects"]));
  } finally { onlyDrafts = false; }
});
