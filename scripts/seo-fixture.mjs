import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { extractTitle, extractMetaDescription } from "@jdevalk/astro-seo-graph/integration";
import {
  USERMAVEN_PROXY_PATH,
  USERMAVEN_SCRIPT_PATH,
  buildUsermavenProxyUrls,
} from "../apps/marketing-site/src/utils/usermaven.ts";

const root = new URL("../", import.meta.url);
const marketingRequire = createRequire(new URL("../apps/marketing-site/package.json", import.meta.url));
const { unstable_readConfig: readWranglerConfig } = marketingRequire("wrangler");
const configuredUsermavenKey = readWranglerConfig(
  { config: fileURLToPath(new URL("apps/marketing-site/wrangler.jsonc", root)) },
  { hideWarnings: true },
).vars?.USERMAVEN_KEY;
const original = JSON.parse(readFileSync(new URL("apps/marketing-site/seed/seed.json", root)));
const description = (name) =>
  `Fixture ${name} metadata description for verifying the rendered SEO validation pipeline.`;
const paragraph = (key, text) => [{ _type: "block", _key: key, style: "normal", children: [
  { _type: "span", _key: `${key}-span`, text },
] }];
const image = {
  $media: { file: "assets/post-1.webp", alt: "Fixture image" },
};
const layoutHero = (slug) => [{
  _type: "hero", _key: `layout-${slug}`, _version: 1, variant: "centered",
  heading: `Fixture ${slug} layout heading`, body: `Fixture ${slug} layout body`, links: [],
}];
// The seeded home: a hero, then the recent posts the posts block reads.
const layoutHome = [
  ...layoutHero("home"),
  { _type: "posts", _key: "layout-home-posts", _version: 1, variant: "featured-grid", count: 4 },
];
// Every offered block type renders through the published layout route; the
// fixture proves each section (sources included) end to end in CI.
const layoutNewBlocks = (slug) => [
  { _type: "prose", _key: `layout-${slug}-prose`, _version: 1, variant: "centered",
    heading: `Fixture ${slug} prose heading`, body: `Fixture ${slug} prose body`,
    content: [...paragraph(`${slug}-prose-p`, `Fixture ${slug} prose paragraph.`),
      { _type: "block", _key: `${slug}-prose-quote`, style: "blockquote", children: [
        { _type: "span", _key: `${slug}-prose-quote-span`, text: "Fixture quoted line one\nFixture quoted line two" },
      ] },
      { _type: "code", _key: `${slug}-prose-code`, code: `fixture ${slug} prose code block`, language: "js" },
      { _type: "image", _key: `${slug}-prose-image`, alt: "Fixture diagram", asset: {
        $media: { file: "assets/post-1.webp", alt: "Fixture diagram" },
      } }] },
  { _type: "faq", _key: `layout-${slug}-faq`, _version: 1, variant: "two-column", scope: "all" },
  { _type: "stats", _key: `layout-${slug}-stats`, _version: 1, variant: "graph",
    eyebrow: `Fixture ${slug} stats eyebrow`, heading: `Fixture ${slug} stats heading`, body: `Fixture ${slug} stats body`,
    items: [{ _key: `${slug}-stat`, value: "99%", label: `Fixture ${slug} stat label` }] },
  { _type: "team", _key: `layout-${slug}-team`, _version: 1, variant: "four-column", scope: "all" },
  // Every posts variant renders through its own site section (default included:
  // the block without a variant falls back to it), each reading the posts source.
  { _type: "posts", _key: `layout-${slug}-posts-grid`, _version: 1, variant: "grid", count: 2,
    heading: `Fixture ${slug} posts grid heading` },
  { _type: "posts", _key: `layout-${slug}-posts-list`, _version: 1, variant: "list", count: 2,
    heading: `Fixture ${slug} posts list heading` },
  { _type: "posts", _key: `layout-${slug}-posts-default`, _version: 1, heading: `Fixture ${slug} posts default heading` },
  { _type: "comparison", _key: `layout-${slug}-comparison`, _version: 1, variant: "table",
    columns: [
      { _key: `${slug}-col-first`, key: "first", label: "Starter" },
      { _key: `${slug}-col-second`, key: "second", label: "Growth" },
      { _key: `${slug}-col-third`, key: "third", label: "Pro" },
    ],
    rows: [{ _key: `${slug}-row`, group_name: `Fixture ${slug} comparison group`, name: `Fixture ${slug} comparison feature`,
      first_value: "true", second_value: "false", third_value: `Fixture ${slug} comparison value` }] },
];
const page = (slug, layout) => ({
  id: slug, slug, status: "published",
  data: { title: `Fixture ${slug}`, ...(layout ? { layout } : {}) },
});
const codeBlock = [{
  _type: "code-block-pro", _key: "upgrade-code", code: 'console.log("astro7-renderer-fixture");',
  language: "javascript", copyButton: true,
}];
const quotedBlock = {
  _type: "block", _key: "fixture-quote", style: "blockquote",
  children: [{ _type: "span", _key: "fixture-quote-span", text: "Fixture quoted line one\nFixture quoted line two" }],
};
const diagramBlock = {
  _type: "image", _key: "fixture-diagram", alt: "Fixture diagram",
  asset: { $media: { file: "assets/post-1.webp", alt: "Fixture diagram" } },
};
const richContent = [...codeBlock, quotedBlock, diagramBlock];
const entries = {
  pages: [
    page("home", layoutHome),
    // About has no layout; its route renders the hand-written body as its fallback.
    page("about"),
    page("contact", layoutHero("contact")),
    // A page with a published layout renders it; the same entry goes draft in
    // the unpublished state and must 404.
    page("pricing", layoutHero("pricing")),
    // The five blocks added in ticket 20 render through the same published-route
    // layout switch on the page that used to hold the document block.
    page("privacy-policy", layoutNewBlocks("privacy-policy")),
    page("fixture-page", layoutHero("fixture-page")),
    { ...page("fixture-draft"), status: "draft" },
  ],
  posts: [
    { id: "fixture-post", slug: "fixture-post", status: "published",
      data: { title: "Fixture post heading", excerpt: `${description("post excerpt")} & shipped`, content: richContent, featured_image: image } },
    { id: "fixture-fallback", slug: "fixture-fallback", status: "published",
      data: { title: "Fixture fallback title", excerpt: description("fallback excerpt"), content: [], featured_image: image } },
  ],
  projects: [
    { id: "fixture-project", slug: "fixture-project", status: "published",
      data: { title: "Fixture project heading & scope", summary: description("project summary"), url: "javascript:alert(29)", content: richContent, featured_image: image } },
    { id: "fixture-fallback-project", slug: "fixture-fallback-project", status: "published",
      data: { title: "Fixture project fallback", summary: description("fallback project summary"), url: "https://example.com/safe-project", content: [], featured_image: image } },
  ],
  faqs: [
    { id: "fixture-faq", slug: "fixture-faq", status: "published",
      data: { question: "Fixture FAQ question", answer: "Fixture FAQ answer" } },
  ],
  team: [
    { id: "fixture-member", slug: "fixture-member", status: "published",
      data: { name: "Fixture Member", role: "Fixture member role" } },
  ],
};
const site = {
  title: "Fixture Marketing Testing",
  tagline: description("listing"),
};
const fixtureSeo = (slug) => ({
  title: `Fixture ${slug} SEO title`,
  description: description(slug),
});

function createSeed(path, unpublished = false) {
  mkdirSync(join(dirname(path), "assets"), { recursive: true });
  copyFileSync(new URL("apps/marketing-site/seed/assets/post-1.webp", root), join(dirname(path), "assets/post-1.webp"));
  const seed = {
    ...original,
    settings: site,
    collections: original.collections.map(collection => collection.slug === "posts"
      ? { ...collection, description: description("posts collection") } : collection),
    taxonomies: original.taxonomies.map(({ terms, ...taxonomy }) => taxonomy),
    bylines: [],
    menus: original.menus.map((menu) => ({ ...menu, items: [] })),
    content: structuredClone(entries),
  };
  if (unpublished) {
    seed.content.pages = seed.content.pages.filter(entry => entry.slug !== "contact");
    for (const entry of seed.content.pages) {
      if (["pricing", "privacy-policy", "fixture-page"].includes(entry.slug)) entry.status = "draft";
    }
    for (const collection of ["posts", "projects"]) {
      for (const entry of seed.content[collection]) entry.status = "draft";
    }
  }
  writeFileSync(path, JSON.stringify(seed));
}

function applySeo(path, seedPath) {
  const { content } = JSON.parse(readFileSync(seedPath, "utf8"));
  const db = new DatabaseSync(path);
  try {
    const insert = db.prepare("INSERT INTO _emdash_seo (collection, content_id, seo_title, seo_description) VALUES (?, ?, ?, ?)");
    for (const [collection, records] of Object.entries(content)) {
      const get = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`);
      for (const entry of records) {
        if (entry.slug === "fixture-fallback" || entry.slug === "fixture-fallback-project") continue;
        const row = get.get(entry.slug);
        if (!row) throw new Error(`Missing fixture ${collection}/${entry.slug}`);
        const seo = fixtureSeo(entry.slug);
        insert.run(collection, row.id, seo.title, seo.description);
      }
    }
  } finally {
    db.close();
  }
}

async function verifyDraftPreviews(origin, database) {
  // Let EmDash initialize its local-only signing secret, then read that same secret.
  // Neither the secret nor signed URLs are printed or persisted as evidence.
  await fetch(new URL("/?_preview=invalid", origin), { redirect: "manual" });
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const secretRow = db.prepare("SELECT value FROM options WHERE name = ?").get("emdash:preview_secret");
    if (!secretRow) throw new Error("Local EmDash preview secret was not initialized");
    const secret = JSON.parse(secretRow.value);
    const require = createRequire(new URL("../apps/marketing-site/package.json", import.meta.url));
    const { generatePreviewToken, buildPreviewUrl } = await import(require.resolve("emdash"));
    for (const [collection, slug, path] of [
      ["pages", "fixture-page", "/pages/fixture-page"],
      ["posts", "fixture-post", "/posts/fixture-post"],
    ]) {
      const row = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(slug);
      if (!row) throw new Error(`Missing preview fixture ${collection}/${slug}`);
      const token = await generatePreviewToken({ contentId: `${collection}:${row.id}`, secret });
      const previewUrl = buildPreviewUrl({ path, token, baseUrl: origin });
      const preview = await fetch(previewUrl, { redirect: "manual" });
      if (preview.status !== 200) throw new Error(`${path}: preview expected HTTP 200, got ${preview.status}`);
      const cacheControl = preview.headers.get("cache-control");
      if (cacheControl !== "private, no-store") throw new Error(`${path}: preview cache-control was ${cacheControl}`);
      const html = await preview.text();
      if (extractTitle(html) !== `${fixtureSeo(slug).title} — ${site.title}`) {
        throw new Error(`${path}: preview fixture content/SEO was not rendered`);
      }
      const anonymous = await fetch(new URL(path, origin), { redirect: "manual" });
      const wrongToken = await fetch(buildPreviewUrl({ path, token: "invalid", baseUrl: origin }), { redirect: "manual" });
      if (anonymous.status !== 404 || wrongToken.status !== 404) {
        throw new Error(`${path}: anonymous or invalid-token request exposed a draft`);
      }
      for (const endpoint of ["/sitemap.xml", "/llms.txt"]) {
        const response = await fetch(new URL(endpoint, origin));
        if (response.status !== 200 || (await response.text()).includes(path)) {
          throw new Error(`${path}: preview leaked into ${endpoint}`);
        }
      }
      // The draft's OG image follows the same rule: the verified token renders
      // it as a session-specific PNG, anonymous requests get nothing.
      const ogPath = `/og/${collection}/${slug}.png`;
      const ogPreview = await fetch(new URL(`${ogPath}?_preview=${encodeURIComponent(token)}`, origin), { redirect: "manual" });
      const ogBytes = new Uint8Array(await ogPreview.arrayBuffer());
      const ogPng = ogBytes.length > 4 && ogBytes[0] === 0x89 && ogBytes[1] === 0x50 && ogBytes[2] === 0x4e && ogBytes[3] === 0x47;
      if (ogPreview.status !== 200 || ogPreview.headers.get("content-type") !== "image/png" || !ogPng) {
        throw new Error(`${ogPath}: preview expected HTTP 200 image/png with PNG magic bytes, got HTTP ${ogPreview.status} ${ogPreview.headers.get("content-type")}`);
      }
      if (ogPreview.headers.get("cache-control") !== "private, no-store") {
        throw new Error(`${ogPath}: preview cache-control was ${ogPreview.headers.get("cache-control")}`);
      }
      const ogAnonymous = await fetch(new URL(ogPath, origin), { redirect: "manual" });
      if (ogAnonymous.status !== 404) {
        throw new Error(`${ogPath}: anonymous request exposed a draft OG image (HTTP ${ogAnonymous.status})`);
      }
      console.log(`${ogPath}: valid preview token HTTP 200 image/png (PNG magic bytes); Cache-Control: private, no-store; anonymous HTTP 404`);
      console.log(`${path}: valid preview HTTP 200; Cache-Control: private, no-store; anonymous/invalid token HTTP 404; absent from sitemap and llms.txt`);
    }
  } finally {
    db.close();
  }
}

function createGardenCodeSeed(path) {
  const seed = JSON.parse(readFileSync(new URL("apps/digital-garden/seed/seed.json", root)));
  seed.content = {
    posts: [{ id: "fixture-post", slug: "fixture-post", status: "published",
      data: { title: "Fixture garden post", content: richContent } }],
    projects: [{ id: "fixture-project", slug: "fixture-project", status: "published",
      data: { title: "Fixture garden project", url: "data:text/html,unsafe-project", content: richContent } }],
    pages: seed.content.pages.filter(entry => entry.slug === "privacy-policy"),
  };
  for (const page of seed.content.pages) {
    for (const block of page.data.content ?? []) {
      if (block._type === "marketing.document") block.content += '<script>unsafe-document-marker</script><p onclick="unsafe-handler-marker">Safe document marker</p>';
    }
  }
  seed.bylines = [];
  seed.menus = seed.menus.map(menu => ({ ...menu, items: [] }));
  mkdirSync(join(dirname(path), "assets"), { recursive: true });
  copyFileSync(new URL("apps/marketing-site/seed/assets/post-1.webp", root), join(dirname(path), "assets/post-1.webp"));
  writeFileSync(path, JSON.stringify(seed));
}

const NOT_FOUND_BANNED = [
  "btn-primary", "btn-secondary", "btn-lg", "not-found", "--spacing-", "--font-size-",
  "--max-width", "var(--radius)", "--color-primary", "--color-accent",
  "!text-olive-300", "dark:!text-olive-600",
];

async function verifyNotFound(origin, secondLink) {
  const notFound = await fetch(new URL("/this-page-is-missing", origin), { redirect: "manual" });
  const notFoundHtml = await notFound.text();
  if (notFound.status !== 404) throw new Error(`/404: HTTP ${notFound.status}`);
  for (const text of ["Page not found", "The page you're looking for doesn't exist or has been moved.", "Go home", secondLink]) {
    if (!notFoundHtml.includes(text)) throw new Error(`/404: missing ${JSON.stringify(text)}`);
  }
  for (const banned of NOT_FOUND_BANNED) {
    if (notFoundHtml.includes(banned)) throw new Error(`/404: still contains ${banned}`);
  }
  console.log("/404: olive not-found page rendered");
}

async function verifyOgImages(origin, available, missing) {
  const check = async (path, expected) => {
    const response = await fetch(new URL(path, origin), { redirect: "manual" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const isPng = bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const cacheControl = response.headers.get("cache-control") || "";
    if (expected === 200) {
      if (response.status !== 200 || response.headers.get("content-type") !== "image/png" || !isPng) {
        throw new Error(`${path}: expected HTTP 200 image/png with PNG magic bytes, got HTTP ${response.status} ${response.headers.get("content-type")}`);
      }
      if (cacheControl.includes("immutable") || !cacheControl.includes("max-age=3600") || !cacheControl.includes("stale-while-revalidate")) {
        throw new Error(`${path}: expected a bounded revalidateable Cache-Control, got "${cacheControl}"`);
      }
      console.log(`${path}: HTTP 200 image/png (PNG magic bytes); Cache-Control: ${cacheControl}`);
    } else if (response.status !== 404 || cacheControl.includes("immutable")) {
      throw new Error(`${path}: expected HTTP 404 without immutable caching, got HTTP ${response.status} "${cacheControl}"`);
    } else {
      console.log(`${path}: HTTP 404; not renderable through the OG routes, no immutable caching`);
    }
  };
  for (const path of available) await check(path, 200);
  for (const path of missing) await check(path, 404);
}

async function verifyCodeRenderer(origin, notFoundLink) {
  for (const path of ["/posts/fixture-post", "/projects/fixture-project"]) {
    const response = await fetch(new URL(path, origin), { redirect: "manual" });
    const html = await response.text();
    if (response.status !== 200 || !html.includes('class="cbp-copy-btn"') || !html.includes('class="shiki') || !html.includes("astro7-renderer-fixture")) {
      throw new Error(`${path}: registered Code Block Pro renderer did not render highlighted code and copy button (HTTP ${response.status})`);
    }
    if (path.startsWith("/projects/") && (html.includes("prose-olive") || !html.includes("project-prose"))) {
      throw new Error(`${path}: project Portable Text is missing project-prose styling`);
    }
    console.log(`${path}: registered Code Block Pro renderer rendered highlighted code and copy button`);
  }
  if (notFoundLink) await verifyNotFound(origin, notFoundLink);
}

async function verifyUntrustedSurfaces(origin, garden = false) {
  const project = await fetch(new URL("/projects/fixture-project", origin));
  const html = await project.text();
  if (project.status !== 200 || /href="(?:javascript:|data:)/i.test(html) || html.includes("Visit site")) {
    throw new Error("Unsafe CMS project URL rendered as a link");
  }
  if (garden) {
    const sitemap = await (await fetch(new URL("/sitemap.xml", origin))).text();
    if (sitemap.includes("/contact</loc>") || !sitemap.includes("/projects</loc>")) throw new Error("Garden sitemap contact/project availability is wrong");
    for (const method of ["GET", "POST"]) {
      const response = await fetch(new URL("/contact", origin), { method });
      if (response.status !== 404) throw new Error(`Garden contact ${method}: expected 404, got ${response.status}`);
    }
    const document = await (await fetch(new URL("/privacy-policy", origin))).text();
    if (!document.includes("Safe document marker") || document.includes("unsafe-document-marker") || document.includes("unsafe-handler-marker")) {
      throw new Error("Garden document HTML was not sanitized");
    }
  } else {
    const safe = await (await fetch(new URL("/projects/fixture-fallback-project", origin))).text();
    if (!safe.includes('href="https://example.com/safe-project"')) throw new Error("Safe CMS project link missing");
  }
  console.log("Untrusted surfaces: unsafe project link omitted; " + (garden ? "document sanitized; absent contact GET/POST 404 and sitemap correct" : "safe project link retained"));
}

async function verifyUsermaven(origin, unconfigured) {
  if (!configuredUsermavenKey) {
    throw new Error("apps/marketing-site/wrangler.jsonc is missing production vars.USERMAVEN_KEY");
  }
  const homeHtml = await (await fetch(new URL("/", origin))).text();
  if (unconfigured) {
    for (const marker of ["um-tracker", "usermaven", "data-form-tracking", USERMAVEN_SCRIPT_PATH, configuredUsermavenKey]) {
      if (homeHtml.includes(marker)) {
        throw new Error(`/: Usermaven marker ${JSON.stringify(marker)} rendered when USERMAVEN_KEY is unset`);
      }
    }
    const unconfiguredScript = await fetch(new URL(USERMAVEN_SCRIPT_PATH, origin), { redirect: "manual" });
    await unconfiguredScript.text();
    const unconfiguredEvent = await fetch(new URL(`${USERMAVEN_PROXY_PATH}/api/v1/event`, origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "pageview" }),
      redirect: "manual",
    });
    await unconfiguredEvent.text();
    if (unconfiguredScript.status !== 404 || unconfiguredEvent.status !== 404) {
      throw new Error(
        `Usermaven proxy expected HTTP 404 when USERMAVEN_KEY is unset, got ${unconfiguredScript.status} and ${unconfiguredEvent.status}`,
      );
    }
    console.log(`/: Usermaven snippet absent and ${USERMAVEN_PROXY_PATH}/* HTTP 404 when USERMAVEN_KEY is unset`);
    return;
  }
  const { trackingHost, scriptSrc } = buildUsermavenProxyUrls(origin);
  for (const requiredMarker of [
    "um-tracker",
    JSON.stringify(trackingHost),
    JSON.stringify(scriptSrc),
    configuredUsermavenKey,
    "data-tracking-host",
    "data-key",
    'setAttribute("data-autocapture", "true")',
    'setAttribute("data-form-tracking", "tagged")',
    'setAttribute("data-privacy-policy", "strict")',
    'setAttribute("data-randomize-url", "true")',
  ]) {
    if (!homeHtml.includes(requiredMarker)) {
      throw new Error(`/: Usermaven snippet missing ${JSON.stringify(requiredMarker)} when USERMAVEN_KEY is configured`);
    }
  }
  for (const forbiddenHost of ["um.jamesryan.dev", "t.usermaven.com", "events.usermaven.com"]) {
    if (homeHtml.includes(forbiddenHost)) {
      throw new Error(`/: Usermaven snippet must use first-party proxy path, found ${forbiddenHost}`);
    }
  }
  console.log("/: Usermaven first-party proxy snippet rendered when USERMAVEN_KEY is configured");
}

async function verify(origin, unpublished = false, database) {
  const routes = {
    "/": "home", "/about": "about", "/contact": "contact", "/pricing": "pricing",
    "/privacy-policy": "privacy-policy", "/pages/fixture-page": "fixture-page",
    "/posts/fixture-post": "fixture-post", "/projects/fixture-project": "fixture-project",
  };
  const unavailable = ["/pages/fixture-draft", "/pages/fixture-missing", "/posts/missing-post",
    "/category/missing-category", "/tag/missing-tag", "/home-01", "/home-02", "/home-03",
    "/about-01", "/about-02", "/about-03", "/pricing-01", "/pricing-02", "/pricing-03",
    "/privacy-policy-01", "/privacy-policy-02", "/404-01", "/404-02"];
  if (unpublished) {
    unavailable.push("/contact", "/pricing", "/privacy-policy", "/pages/fixture-page", "/projects",
      "/projects/fixture-project", "/projects/fixture-fallback-project",
      "/posts", "/posts/fixture-post", "/posts/fixture-fallback");
    for (const path of unavailable) delete routes[path];
  }
  const llmsResponse = await fetch(new URL("/llms.txt", origin));
  if (llmsResponse.status !== 200) throw new Error(`llms.txt: HTTP ${llmsResponse.status}`);
  const llms = await llmsResponse.text();
  const llmsPaths = [...llms.matchAll(/\]\((https?:[^)]+)\)/g)].map(match => new URL(match[1]).pathname);
  const sitemap = await (await fetch(new URL("/sitemap.xml", origin))).text();
  const paths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gs)].map((match) => new URL(match[1]).pathname);
  const expected = [...Object.keys(routes),
    ...(unpublished ? [] : ["/posts", "/posts/fixture-fallback", "/projects", "/projects/fixture-fallback-project"])];
  if (new Set(paths).size !== paths.length || expected.some((path) => !paths.includes(path)) || paths.some(path => !expected.includes(path))) {
    throw new Error("Fixture sitemap is missing a route or contains duplicates");
  }
  console.log("Fixture sitemap includes every route exactly once");
  if (expected.some(path => !llmsPaths.includes(path)) || llmsPaths.some(path => !expected.includes(path))) {
    throw new Error("Fixture llms.txt does not match public routes");
  }
  for (const path of unavailable) {
    const response = await fetch(new URL(path, origin), { redirect: "manual" });
    if (response.status !== 404 || paths.includes(path) || llmsPaths.includes(path)) {
      throw new Error(`${path}: expected HTTP 404 and absence from sitemap and llms.txt, got HTTP ${response.status}`);
    }
    console.log(`${path}: HTTP 404; absent from sitemap and llms.txt`);
  }
  for (const path of expected) {
    const response = await fetch(new URL(path, origin), { redirect: "manual" });
    if (response.status !== 200) throw new Error(`${path}: expected HTTP 200, got ${response.status}`);
    console.log(`${path}: HTTP 200; present in sitemap and llms.txt`);
  }
  for (const [path, slug] of Object.entries(routes)) {
    const response = await fetch(new URL(path, origin));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const html = await response.text();
    const seo = fixtureSeo(slug);
    if (extractTitle(html) !== `${seo.title} — ${site.title}` ||
        extractMetaDescription(html) !== seo.description) {
      throw new Error(`${path}: fixture SEO fields were not rendered`);
    }
    console.log(`${path}: fixture SEO fields rendered`);
  }
  if (!unpublished) {
    await verifyCodeRenderer(origin);
    const layoutHtml = await (await fetch(new URL("/pricing", origin))).text();
    if (!layoutHtml.includes("Fixture pricing layout heading")) {
      throw new Error("/pricing: the published layout was not rendered");
    }
    console.log("/pricing: published layout rendered");
    const newBlocksHtml = await (await fetch(new URL("/privacy-policy", origin))).text();
    if (!newBlocksHtml.includes("Fixture privacy-policy prose heading")) {
      throw new Error("/privacy-policy: the published layout was not rendered");
    }
    for (const marker of [
      "Fixture privacy-policy prose paragraph.", "fixture privacy-policy prose code block",
      "Questions &amp; Answers", "Fixture FAQ question",
      "Fixture privacy-policy stats heading", "Fixture privacy-policy stat label",
      "Fixture Member",
      "Fixture privacy-policy comparison group", "Fixture privacy-policy comparison feature",
      "Fixture privacy-policy posts grid heading", "Fixture privacy-policy posts list heading",
      "Fixture privacy-policy posts default heading", "Fixture fallback title",
    ]) {
      if (!newBlocksHtml.includes(marker)) {
        throw new Error(`/privacy-policy: layout section marker missing: ${marker}`);
      }
    }
    console.log("/privacy-policy: layout renders prose, faq, stats, team, comparison and posts sections");
    const homeHtml = await (await fetch(new URL("/", origin))).text();
    if (!homeHtml.includes("Fixture post heading") || !homeHtml.includes("Fixture fallback title")) {
      throw new Error("/: the posts block did not render the recent posts");
    }
    console.log("/: posts block rendered the recent posts");
    const aboutHtml = await (await fetch(new URL("/about", origin))).text();
    if (!aboutHtml.includes("I'm James Ryan.")) {
      throw new Error("/about: the hand-written fallback was not rendered for a page without layout");
    }
    console.log("/about: hand-written fallback rendered for a page without layout");
  }
  if (unpublished) {
    await verifyUsermaven(origin, true);
    await verifyDraftPreviews(origin, database);
    await verifyOgImages(origin, ["/og/default.png"],
      ["/og/posts/fixture-post.png", "/og/projects/fixture-project.png", "/og/pages/fixture-page.png", "/og/blog/fixture-post.png"]);
    return;
  }
  await verifyUsermaven(origin, false);
  const listingHtml = await (await fetch(new URL("/posts", origin))).text();
  if (extractMetaDescription(listingHtml) !== description("posts collection")) {
    throw new Error("/posts: collection description was not rendered");
  }
  if (extractTitle(listingHtml) !== `Blog — ${site.title}`) {
    throw new Error(`/posts: title was ${JSON.stringify(extractTitle(listingHtml))}`);
  }
  console.log(`/posts: title ${extractTitle(listingHtml)}`);
  console.log("/posts: collection description rendered");
  await verifyNotFound(origin, "Read the blog");
  const html = await (await fetch(new URL("/posts/fixture-fallback", origin))).text();
  if (extractTitle(html) !== `Fixture fallback title — ${site.title}` ||
      extractMetaDescription(html) !== description("fallback excerpt")) {
    throw new Error("/posts/fixture-fallback: entry title/excerpt fallback was not rendered");
  }
  console.log("/posts/fixture-fallback: entry title/excerpt fallback rendered");
  const projectHtml = await (await fetch(new URL("/projects/fixture-fallback-project", origin))).text();
  if (extractTitle(projectHtml) !== `Fixture project fallback — ${site.title}` ||
      extractMetaDescription(projectHtml) !== description("fallback project summary")) {
    throw new Error("/projects/fixture-fallback-project: entry title/summary fallback was not rendered");
  }
  if (projectHtml.includes("prose-olive") || !projectHtml.includes("project-prose")) {
    throw new Error("/projects/fixture-fallback-project: Portable Text is missing project-prose styling");
  }
  console.log("/projects/fixture-fallback-project: entry title/summary fallback rendered");
  await verifyUntrustedSurfaces(origin);
  await verifyOgImages(origin,
    ["/og/default.png", "/og/posts/fixture-post.png", "/og/projects/fixture-project.png", "/og/pages/home.png"],
    ["/og/pages/fixture-draft.png", "/og/posts/missing-post.png", "/og/blog/fixture-post.png", "/og/work/fixture-project.png"]);
}

const [action, value, seedPath] = process.argv.slice(2);
if (!value) throw new Error("usage: node scripts/seo-fixture.mjs seed|seo|verify <path-or-origin>");
if (action === "seed" || action === "seed-unpublished") createSeed(value, action === "seed-unpublished");
else if (action === "seed-garden-code") createGardenCodeSeed(value);
else if (action === "verify-code") {
  await verifyCodeRenderer(value, "Contact us");
  await verifyUntrustedSurfaces(value, true);
  await verifyOgImages(value,
    ["/og/default.png", "/og/posts/fixture-post.png", "/og/projects/fixture-project.png"],
    ["/og/posts/missing-post.png", "/og/blog/fixture-post.png", "/og/pages/home.png"]);
}
else if (action === "seo") applySeo(value, seedPath);
else if (action === "verify" || action === "verify-unpublished") await verify(value, action === "verify-unpublished", seedPath);
else throw new Error(`Unknown fixture action: ${action}`);
