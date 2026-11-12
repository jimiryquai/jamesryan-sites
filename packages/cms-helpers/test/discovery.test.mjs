import assert from "node:assert/strict";
import { mock, test } from "node:test";
let context;
mock.module("emdash", { namedExports: { getRequestContext: () => context } });
const { discoveryResponse } = await import("../src/discovery-response.ts");

test("discovery responses expose CORS and bounded public caching while preserving status and content type", async () => {
  const response = discoveryResponse(new Response("missing", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "immutable" } }), undefined, 60);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "missing");
  assert.equal(response.headers.get("Content-Type"), "text/plain");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=60");
});

for (const session of [{ editMode: true }, { preview: { entryId: "draft" } }]) {
  test(`discovery disables shared caching for ${Object.keys(session)[0]} requests`, () => {
    context = session;
    try {
      const hints = [];
      const response = discoveryResponse(new Response("published feed"), { enabled: true, set: hint => hints.push(hint) });
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
      assert.deepEqual(hints, [false]);
    } finally { context = undefined; }
  });
}
