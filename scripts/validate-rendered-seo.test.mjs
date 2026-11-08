import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";

async function checkPage(path, html) {
  const server = createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.end(`<urlset><url><loc>https://example.com${path}</loc></url></urlset>`);
    } else if (request.url === "/redirect-to-missing") {
      response.writeHead(302, { location: "/missing" }).end();
    } else if (request.url === "/missing") {
      response.writeHead(404).end();
    } else {
      response.end(html);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/validate-rendered-seo.mjs", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    return { code, output };
  } finally {
    server.close();
  }
}

test("a sitemap page without an H1 fails with its URL and rule", async () => {
  const { code, output } = await checkPage("/about", "<html><body>No heading</body></html>");
  assert.equal(code, 1, output);
  assert.match(output, /\/about.*H1/i);
});

test("a sitemap page with an image missing alt fails with its URL and rule", async () => {
  const { code, output } = await checkPage("/image", "<h1>Heading</h1><img src='/photo.jpg'>");
  assert.equal(code, 1, output);
  assert.match(output, /\/image.*alt/i);
});

test("a clean sitemap page passes", async () => {
  const { code, output } = await checkPage("/clean", `<title>A clear and descriptive page title</title><meta name="description" content="A useful description of the page that is long enough to meet the validator's minimum length."><h1>Heading</h1><img src='/photo.jpg' alt='Photo'>`);
  assert.equal(code, 0, output);
  assert.match(output, /1 pages checked/);
});

test("short metadata fails with its URL and rule", async () => {
  const { code, output } = await checkPage("/short", "<title>Short</title><h1>Heading</h1>");
  assert.equal(code, 1, output);
  assert.match(output, /\/short.*metadata length/i);
});

test("a broken internal link fails with the source and target", async () => {
  const { code, output } = await checkPage("/link", `<title>A clear and descriptive page title</title><meta name="description" content="A useful description of the page that is long enough to meet the validator's minimum length."><h1>Heading</h1><a href="/missing">Missing</a>`);
  assert.equal(code, 1, output);
  assert.match(output, /\/link.*internal link.*\/missing/i);
});

test("an internal link redirecting to a missing page fails", async () => {
  const { code, output } = await checkPage("/link", `<title>A clear and descriptive page title</title><meta name="description" content="A useful description of the page that is long enough to meet the validator's minimum length."><h1>Heading</h1><a href="/redirect-to-missing">Missing</a>`);
  assert.equal(code, 1, output);
  assert.match(output, /\/link.*internal link.*\/redirect-to-missing/i);
});

test("a broken relative internal link fails", async () => {
  const { code, output } = await checkPage("/link", `<title>A clear and descriptive page title</title><meta name="description" content="A useful description of the page that is long enough to meet the validator's minimum length."><h1>Heading</h1><a href="missing">Missing</a>`);
  assert.equal(code, 1, output);
  assert.match(output, /\/link.*internal link.*missing/i);
});

test("duplicate metadata across sitemap pages fails", async () => {
  const html = `<title>A clear and descriptive page title</title><meta name="description" content="A useful description of the page that is long enough to meet the validator's minimum length."><h1>Heading</h1>`;
  const server = createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.end("<urlset><url><loc>https://example.com/first</loc></url><url><loc>https://example.com/second</loc></url></urlset>");
    } else response.end(html);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/validate-rendered-seo.mjs", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.match(output, /\/second.*metadata uniqueness.*\/first/i);
  } finally {
    server.close();
  }
});

test("a sitemap URL that redirects fails instead of validating its destination", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.end("<urlset><url><loc>https://example.com/old</loc></url></urlset>");
    } else if (request.url === "/old") {
      response.writeHead(302, { location: "/new" }).end();
    } else {
      response.end("<h1>Destination</h1>");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/validate-rendered-seo.mjs", `http://127.0.0.1:${server.address().port}`]);
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    const [code] = await once(child, "close");
    assert.equal(code, 1, output);
    assert.match(output, /\/old.*HTTP 302/i);
  } finally {
    server.close();
  }
});
