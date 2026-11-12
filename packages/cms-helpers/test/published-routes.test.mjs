import assert from "node:assert/strict";
import { mock, test } from "node:test";

const entry = (id, status = "published") => ({ id, data: { status, title: id } });
const records = {
  pages: [entry("home"), entry("contact"), entry("custom / page"), entry("pricing", "draft")],
  posts: [entry("post"), entry("draft-post", "draft")],
  projects: [entry("launched"), entry("draft-project", "draft")],
};
const queries = [];
mock.module("emdash", { namedExports: {
  async getEmDashCollection(collection, { status, limit }) {
    queries.push({ kind: "collection", collection, limit });
    return { entries: records[collection].filter(entry => entry.data.status === status).slice(0, limit), cacheHint: { tags: [collection] } };
  },
  async getEmDashEntry(collection, slug) {
    queries.push({ kind: "entry", collection, slug });
    const found = records[collection].find(entry => entry.id === slug);
    return { entry: found ? { ...found, data: { ...found.data, seo: { title: "Hydrated SEO" } } } : null, cacheHint: { tags: [collection] } };
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
