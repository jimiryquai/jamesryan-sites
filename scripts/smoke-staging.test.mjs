import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";

test("smoke checks the post from the sitemap and fails on a missing endpoint", async () => {
  const paths = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    if (request.url === "/sitemap.xml") {
      response.end("<urlset><url><loc>https://production.example/posts/example</loc></url></urlset>");
    } else {
      response.statusCode = request.url === "/llms.txt" ? 404 : 200;
      response.end("ok");
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/smoke-staging.mjs", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.deepEqual(paths.sort(), ["/", "/_emdash/admin", "/llms.txt", "/posts/example", "/robots.txt", "/sitemap.xml"].sort());
    assert.match(output, /404.*\/llms\.txt/);
  } finally {
    server.close();
  }
});

test("smoke checks require a published post even when all endpoints return 200", async () => {
  const server = createServer((request, response) => response.end("<urlset></urlset>"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/smoke-staging.mjs", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.match(output, /sitemap has no post URL/);
  } finally {
    server.close();
  }
});
