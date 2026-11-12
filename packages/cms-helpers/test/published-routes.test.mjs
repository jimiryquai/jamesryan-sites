import assert from "node:assert/strict";
import { mock, test } from "node:test";

const entry = (id, status = "published") => ({ id, data: { status, title: id } });
const records = {
  pages: [entry("home"), entry("contact"), entry("custom / page"), entry("pricing", "draft")],
  posts: [entry("post"), entry("draft-post", "draft")],
  projects: [entry("launched"), entry("draft-project", "draft")],
};
const queries = [];
let previewEntry;
mock.module("emdash", { namedExports: {
    getRequestContext: () => undefined,
    runWithContext: (_context, fn) => fn(),
  async getEmDashCollection(collection, { status, limit }) {
    queries.push({ kind: "collection", collection, limit });
    return { entries: records[collection].filter(entry => entry.data.status === status).slice(0, limit), cacheHint: { tags: [collection] } };
  },
  async getEmDashEntry(collection, slug, options) {
    queries.push({ kind: "entry", collection, slug, references: options?.references });
    const found = records[collection].find(entry => entry.id === slug && (entry.data.status === "published" || previewEntry === `${collection}:${slug}`));
    return { entry: found ? { ...found, data: { ...found.data, seo: { title: "Hydrated SEO" } }, ...(options?.references ? { references: { service: { entries: [{ id: "web", data: { id: "service-id" } }] } } } : {}) } : null, cacheHint: { tags: [collection] } };
  },
} });
const { getPublishedRoutes, getPublishedRoute } = await import("../src/published-routes.ts");

test("every discovered route resolves with one targeted query; drafts, missing entries and aliases do not", async () => {
  const routes = await getPublishedRoutes();
  assert.deepEqual(new Set(routes.keys()), new Set(["/", "/contact", "/pages/custom%20%2F%20page", "/posts/post", "/posts", "/projects/launched", "/projects"]));
  const hints = [];
  for (const [path, listed] of routes) {
    queries.length = 0;
    const route = await getPublishedRoute(path, { enabled: true, set: hint => hints.push(...hint.tags) });
    assert.ok(route, path);
    assert.equal(route.kind, listed.kind, path);
    assert.equal(route.collection, listed.collection, path);
    assert.equal(route.title, listed.title, path);
    assert.equal(queries.length, 1, path);
    if (route.kind === "entry") {
      assert.equal(route.entry.data.seo.title, "Hydrated SEO", path);
      assert.equal(queries[0].kind, "entry", path);
    } else {
      assert.equal(queries[0].limit, 1, path);
    }
  }
  for (const path of ["/pricing", "/privacy-policy", "/posts/draft-post", "/projects/draft-project", "/pages/missing", "/pages/contact", "/posts/%", "/home-01"]) {
    assert.equal(await getPublishedRoute(path), null, path);
  }
  assert.deepEqual(new Set(hints), new Set(["pages", "posts", "projects"]));
});

test("archives disappear from lookup and discovery when only drafts remain", async () => {
  for (const collection of ["posts", "projects"]) {
    const original = records[collection];
    try {
      records[collection] = original.filter(entry => entry.data.status === "draft");
      assert.equal(await getPublishedRoute(`/${collection}`), null);
      const routes = await getPublishedRoutes();
      assert.equal(routes.has(`/${collection}`), false);
      for (const draft of records[collection]) assert.equal(routes.has(`/${collection}/${draft.id}`), false);
    } finally {
      records[collection] = original;
    }
  }
});


test("request-authorized draft previews resolve while anonymous requests and discovery exclude them", async () => {
  for (const [collection, slug, path] of [["pages", "pricing", "/pricing"], ["posts", "draft-post", "/posts/draft-post"]]) {
    assert.equal(await getPublishedRoute(path), null, `${path}: anonymous`);
    try {
      previewEntry = `${collection}:${slug}`;
      const route = await getPublishedRoute(path);
      assert.equal(route?.kind, "entry", `${path}: verified preview`);
      assert.equal(route.entry.data.status, "draft");
      assert.equal((await getPublishedRoutes()).has(path), false, `${path}: discovery`);
    } finally {
      previewEntry = undefined;
    }
    assert.equal(await getPublishedRoute(path), null, `${path}: anonymous after preview`);
  }
});

test("a references selection rides the same single entry read and comes back on the route", async () => {
  queries.length = 0;
  const route = await getPublishedRoute("/contact", undefined, { references: { service: true } });
  assert.equal(route.kind, "entry");
  assert.equal(queries.length, 1);
  assert.equal(queries[0].kind, "entry");
  assert.deepEqual(queries[0].references, { service: true });
  assert.equal(route.entry.references.service.entries[0].data.id, "service-id");
  // Without the option nothing is selected and nothing extra is read.
  queries.length = 0;
  const plain = await getPublishedRoute("/contact");
  assert.equal(plain.kind, "entry");
  assert.equal(queries.length, 1);
  assert.equal(queries[0].references, undefined);
});

test("decoded Markdown route segments resolve space and UTF-8 slugs through the canonical route map", async () => {
  const { getMarkdownContentPath } = await import("../src/content-url.ts");
  for (const slug of ["a post", "café 東京"]) {
    const record = entry(slug);
    records.posts.push(record);
    try {
      const route = await getPublishedRoute(getMarkdownContentPath(`posts/${slug}`));
      assert.equal(route?.kind, "entry");
      assert.equal(route.entry.id, slug);
    } finally { records.posts.pop(); }
  }
  assert.equal(getMarkdownContentPath("posts/a post"), "/posts/a%20post");
  assert.equal(getMarkdownContentPath("home"), "/");
  assert.equal(getMarkdownContentPath(undefined), "/");
});
