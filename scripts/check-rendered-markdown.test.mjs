import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";

// A hung checker must fail the test, not the whole suite: bound every child.
const CHILD_TIMEOUT_MS = 15_000;

const seed = {
  settings: { title: "Fixture Marketing Testing" },
  content: {
    pages: [
      {
        id: "home", slug: "home", status: "published",
        data: {
          title: "Fixture home",
          layout: [{
            _type: "hero", _key: "layout-home", _version: 1, variant: "centered",
            heading: "Fixture home layout heading", body: "Fixture home layout body",
            links: [{ label: "Read the posts", url: "/posts" }],
          }, {
            _type: "posts", _key: "layout-home-posts", _version: 1, variant: "featured-grid",
          }],
        },
      },
      {
        id: "privacy-policy", slug: "privacy-policy", status: "published",
        data: {
          title: "Fixture privacy-policy",
          layout: [
            { _type: "prose", _key: "layout-privacy-policy-prose", _version: 1, heading: "Fixture privacy-policy prose heading", body: "", content: [
              { _type: "block", style: "blockquote", children: [{ _type: "span", text: "Line 1\nLine 2", marks: ["strong"] }] },
              { _type: "code", code: "fixture privacy-policy prose code block", language: "js" },
              { _type: "image", alt: "Fixture policy diagram", url: "https://cdn.example/policy.png" },
              { _type: "image", alt: "", asset: { $media: { file: "assets/empty-alt.png" } } },
            ] },
            { _type: "faq", _key: "layout-privacy-policy-faq", _version: 1, variant: "two-column", scope: "all" },
          ],
        },
      },
      { id: "fixture-draft", slug: "fixture-draft", status: "draft", data: { title: "Fixture draft" } },
    ],
    posts: [
      { id: "fixture-post", slug: "fixture-post", status: "published", data: { title: "Fixture post heading", content: [
        { _type: "block", style: "h2", children: [{ _type: "span", text: "Fixture post section" }] },
        { _type: "block", style: "normal", children: [{ _type: "span", text: "Fixture post paragraph" }] },
        { _type: "code-block-pro", code: 'console.log("astro7-renderer-fixture");', language: "javascript" },
        { _type: "block", style: "blockquote", children: [{ _type: "span", text: "Fixture post quote" }] },
        { _type: "image", alt: "Fixture post diagram", src: "/images/post.png" },
      ] } },
      { id: "fixture-older", slug: "fixture-older", status: "published", data: { title: "Older fixture post", content: [] } },
      { id: "fixture-draft-post", slug: "fixture-draft-post", status: "draft", data: { title: "Draft fixture post", content: [] } },
    ],
    projects: [
      { id: "fixture-project", slug: "fixture-project", status: "published", data: { title: "Fixture project heading", content: [
        { _type: "code", code: "```\nfixture project code\n```", language: "ts" },
      ] } },
    ],
    faqs: [
      { id: "fixture-faq", slug: "fixture-faq", status: "published", data: { question: "Fixture FAQ question", answer: "Fixture FAQ answer" } },
    ],
  },
};

const cleanHome = `# Fixture home
*Published on Fixture Marketing Testing*

# Fixture home layout heading

Fixture home layout body

- [Read the posts](/posts)

- [Older fixture post](/posts/fixture-older)

- [Fixture post heading](/posts/fixture-post)
`;
const fence = (language, code) => "```" + language + "\n" + code + "\n```";
const cleanPrivacy = `# Fixture privacy-policy
*Published on Fixture Marketing Testing*

## Fixture privacy-policy prose heading

> **Line 1
> Line 2**

${fence("js", "fixture privacy-policy prose code block")}

![Fixture policy diagram](https://cdn.example/policy.png)

![](assets/empty-alt.png)

## FAQ

### Fixture FAQ question

Fixture FAQ answer
`;
const cleanPost = `# Fixture post heading
*Published on Fixture Marketing Testing*

## Fixture post section

Fixture post paragraph

${fence("javascript", 'console.log("astro7-renderer-fixture");')}

> Fixture post quote

![Fixture post diagram](/images/post.png)
`;
const cleanOlder = `# Older fixture post
*Published on Fixture Marketing Testing*
`;
const cleanProject = `# Fixture project heading
*Published on Fixture Marketing Testing*

${"````" + "ts\n```\nfixture project code\n```\n````"}
`;
const responses = {
  "/home.md": { body: cleanHome },
  "/privacy-policy.md": { body: cleanPrivacy },
  "/pages/fixture-draft.md": { status: 404, body: "Not found" },
  "/posts/fixture-post.md": { body: cleanPost },
  "/posts/fixture-older.md": { body: cleanOlder },
  "/projects/fixture-project.md": { body: cleanProject },
};

async function check(overrides = {}) {
  const served = { ...responses, ...overrides };
  const directory = mkdtempSync(join(tmpdir(), "markdown-check-"));
  const seedPath = join(directory, "seed.json");
  writeFileSync(seedPath, JSON.stringify(seed));
  const server = createServer((request, response) => {
    const route = served[request.url.split("?")[0]];
    if (!route) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(route.status ?? 200, {
      "Content-Type": route.type ?? "text/markdown; charset=utf-8",
    }).end(route.body);
  });
  // Surface fixture-server failures instead of hanging the child until timeout.
  server.on("error", (error) => console.error("fixture server error:", error));
  server.on("clientError", (error) => console.error("fixture client error:", error.message));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, [
      "scripts/check-rendered-markdown.mjs",
      `http://127.0.0.1:${server.address().port}`,
      seedPath,
    ]);
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.on("error", (error) => (output += `child error: ${error}\n`));
    const killer = setTimeout(() => {
      output += `\nfixture child exceeded ${CHILD_TIMEOUT_MS}ms; killing\n`;
      child.kill("SIGKILL");
    }, CHILD_TIMEOUT_MS);
    try {
      const [code] = await once(child, "close");
      return { code, output };
    } finally {
      clearTimeout(killer);
    }
  } finally {
    server.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("every published page, its layout content and the post and project markdown pass", async () => {
  const { code, output } = await check();
  assert.equal(code, 0, output);
  assert.match(output, /6 markdown routes checked/);
});

test("a page whose markdown lost its layout content fails naming the missing text", async () => {
  const { code, output } = await check({
    "/home.md": { body: `# Fixture home\n*Published on Fixture Marketing Testing*\n` },
  });
  assert.equal(code, 1, output);
  assert.match(output, /\/home\.md.*Fixture home layout heading/);
});

test("a posts block whose markdown lost its post links fails naming the missing link", async () => {
  const { code, output } = await check({
    "/home.md": { body: cleanHome.replace("- [Fixture post heading](/posts/fixture-post)\n", "") },
  });
  assert.equal(code, 1, output);
  assert.match(output, /\/home\.md.*- \[Fixture post heading\]\(\/posts\/fixture-post\)/);
});

test("a shared-content block without its seed items fails naming the item text", async () => {
  const { code, output } = await check({
    "/privacy-policy.md": { body: cleanPrivacy.replace("### Fixture FAQ question\n\nFixture FAQ answer", "## FAQ") },
  });
  assert.equal(code, 1, output);
  assert.match(output, /\/privacy-policy\.md.*Fixture FAQ question/);
});

test("a draft page whose markdown is served fails", async () => {
  const { code, output } = await check({
    "/pages/fixture-draft.md": { body: "# Fixture draft\n" },
  });
  assert.equal(code, 1, output);
  assert.match(output, /\/pages\/fixture-draft\.md.*draft.*HTTP 200/);
});

test("a published page that 404s fails", async () => {
  const { code, output } = await check({ "/home.md": { status: 404, body: "" } });
  assert.equal(code, 1, output);
  assert.match(output, /\/home\.md.*HTTP 404/);
});

test("markdown served with the wrong content type fails", async () => {
  const { code, output } = await check({ "/home.md": { body: cleanHome, type: "text/html" } });
  assert.equal(code, 1, output);
  assert.match(output, /\/home\.md.*content type.*text\/html/);
});

test("a post markdown route that lost its title fails", async () => {
  const { code, output } = await check({ "/posts/fixture-post.md": { body: "" } });
  assert.equal(code, 1, output);
  assert.match(output, /\/posts\/fixture-post\.md.*# Fixture post heading/);
});

test("a post markdown route that lost its fenced code fails naming the fence", async () => {
  const { code, output } = await check({
    "/posts/fixture-post.md": { body: cleanPost.replace(fence("javascript", 'console.log("astro7-renderer-fixture");') + "\n", "") },
  });
  assert.equal(code, 1, output);
  assert.match(output, /\/posts\/fixture-post\.md.*```javascript/);
});

test("a prose block that lost its image and blockquote fails naming them", async () => {
  const { code, output } = await check({
    "/privacy-policy.md": {
      body: cleanPrivacy
        .replace("> **Line 1\n> Line 2**\n", "Line 1\nLine 2\n")
        .replace("![](assets/empty-alt.png)", "![]()"),
    },
  });
  assert.equal(code, 1, output);
  assert.match(output, /\/privacy-policy\.md.*> \*\*Line 1/);
  assert.match(output, /\/privacy-policy\.md: markdown is missing "\/!/);
});

test("a project markdown route that 404s fails under the real URL mapping", async () => {
  const { code, output } = await check({ "/projects/fixture-project.md": { status: 404, body: "" } });
  assert.equal(code, 1, output);
  assert.match(output, /\/projects\/fixture-project\.md.*HTTP 404/);
});
