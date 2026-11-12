import assert from "node:assert/strict";
import { test } from "node:test";

const { getOgImageUrl } = await import("../src/utils/og-image.ts");
test("OG fallbacks use canonical collection prefixes and encode the slug instead of the database ID", () => {
  assert.equal(getOgImageUrl("https://example.com"), "https://example.com/og/default.png");
  assert.equal(getOgImageUrl("https://example.com", { collection: "projects", id: "database-id", slug: "café 東京" }), "https://example.com/og/projects/caf%C3%A9%20%E6%9D%B1%E4%BA%AC.png");
  assert.equal(getOgImageUrl("https://example.com", { collection: "posts", id: "database-id", slug: "a post" }), "https://example.com/og/posts/a%20post.png");
  assert.equal(getOgImageUrl("https://example.com", { collection: "pages", id: "about" }), "https://example.com/og/pages/about.png");
});
