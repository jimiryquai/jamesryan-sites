import assert from "node:assert/strict";
import { mock, test } from "node:test";

let serviceStatus = "published";
const records = [
  { id: "public", data: { status: "published" } },
  { id: "draft", data: { status: "draft" } },
  { id: "unrelated", data: { status: "published" } },
];
mock.module("emdash", { namedExports: {
  async getEmDashEntry() {
    return { entry: { data: { id: "service-id", status: serviceStatus } }, cacheHint: { tags: ["service"], lastModified: new Date("2026-01-01") } };
  },
  async getEmDashCollection(collection, { status, cursor }) {
    const matching = records.filter(entry => !status || entry.data.status === status);
    const offset = Number(cursor || 0);
    return { entries: matching.slice(offset, offset + 1), nextCursor: offset + 1 < matching.length ? String(offset + 1) : undefined,
      cacheHint: { tags: [collection], lastModified: new Date("2026-02-01") } };
  },
  async getEmDashReferences(collection, slug) {
    return { entries: slug === "unrelated" ? [] : [{ data: { id: "service-id" } }], cacheHint: { tags: [`reference:${slug}`], lastModified: new Date("2026-03-01") } };
  },
} });
const { getServiceEntries } = await import("../src/service-content.ts");

test("service content includes only published linked entries across pages and merges their cache hints", async () => {
  const result = await getServiceEntries("pricing", "consulting");
  assert.deepEqual(result.entries.map(entry => entry.id), ["public"]);
  assert.deepEqual(new Set(result.cacheHint.tags), new Set(["service", "pricing", "reference:public", "reference:unrelated"]));
  assert.equal(result.cacheHint.lastModified.toISOString(), "2026-03-01T00:00:00.000Z");
});

test("unpublished services expose no shared content, including during authorized draft reads", async () => {
  serviceStatus = "draft";
  try {
    const result = await getServiceEntries("pricing", "consulting");
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.cacheHint.tags, ["service"]);
  } finally { serviceStatus = "published"; }
});
