import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";

function spawnSmoke(command, args) {
  return spawn(command, args, { env: { ...process.env, SMOKE_TIMEOUT_MS: '1000', SMOKE_RETRY_MS: '10' } });
}

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
    const child = spawnSmoke(process.execPath, ["scripts/smoke-staging.mjs", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.deepEqual([...new Set(paths)].sort(), ["/", "/_emdash/admin/login", "/llms.txt", "/posts/example", "/robots.txt", "/sitemap.xml"].sort());
    assert.match(output, /404.*\/llms\.txt/);
  } finally {
    server.close();
  }
});

test("smoke checks reject a redirect to a healthy page", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.end("<urlset><url><loc>https://example.com/posts/example</loc></url></urlset>");
    } else if (request.url === "/posts/example") {
      response.writeHead(302, { location: "/" }).end();
    } else response.end("ok");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawnSmoke(process.execPath, ["scripts/smoke-staging.mjs", `http://127.0.0.1:${server.address().port}`]);
    const [code] = await once(child, "close");
    assert.equal(code, 1);
  } finally {
    server.close();
  }
});

test("smoke checks require a published post even when all endpoints return 200", async () => {
  const server = createServer((request, response) => response.end("<urlset></urlset>"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawnSmoke(process.execPath, ["scripts/smoke-staging.mjs", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.match(output, /sitemap has no post URL/);
  } finally {
    server.close();
  }
});

test("optional posts allow an empty sitemap without skipping required endpoints", async () => {
  const paths = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    response.end("<urlset></urlset>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawnSmoke(process.execPath, ["scripts/smoke-staging.mjs", "--posts=optional", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 0, output);
    assert.match(output, /no posts yet/);
    assert.deepEqual([...new Set(paths)].sort(), ["/", "/_emdash/admin/login", "/llms.txt", "/robots.txt", "/sitemap.xml"].sort());
  } finally {
    server.close();
  }
});

test("optional posts are checked when the sitemap contains one", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.end("<urlset><url><loc>https://example.com/posts/example</loc></url></urlset>");
    } else {
      response.statusCode = request.url === "/posts/example" ? 404 : 200;
      response.end("ok");
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawnSmoke(process.execPath, ["scripts/smoke-staging.mjs", "--posts=optional", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.match(output, /404.*\/posts\/example/);
  } finally {
    server.close();
  }
});

test("optional post setting applies only to the next site", async () => {
  const server = createServer((request, response) => response.end("<urlset></urlset>"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const child = spawnSmoke(process.execPath, ["scripts/smoke-staging.mjs", "--posts=optional", origin, origin]);
    let output = "";
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.match(output, /sitemap has no post URL/);
  } finally {
    server.close();
  }
});
