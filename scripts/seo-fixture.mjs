import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { extractTitle, extractMetaDescription } from "@jdevalk/astro-seo-graph/integration";

const root = new URL("../", import.meta.url);
const original = JSON.parse(readFileSync(new URL("apps/marketing-site/seed/seed.json", root)));
const description = (name) =>
  `Fixture ${name} metadata description for verifying the rendered SEO validation pipeline.`;
const heading = (text) => [{ _type: "block", _key: "heading", style: "h1", children: [
  { _type: "span", _key: "text", text },
] }];
const image = {
  $media: { url: "https://example.com/fixture.jpg", alt: "Fixture image", filename: "fixture.jpg" },
};
const page = (slug, content = []) => ({
  id: slug, slug, status: "published", data: { title: `Fixture ${slug}`, content },
});
const entries = {
  pages: [
    page("home", [{ _type: "marketing.hero", _key: "hero", headline: "Fixture home heading" }]),
    page("about"), page("contact"), page("pricing"),
    page("privacy-policy", heading("Fixture privacy heading")),
    page("fixture-page", heading("Fixture custom heading")),
  ],
  posts: [
    { id: "fixture-post", slug: "fixture-post", status: "published",
      data: { title: "Fixture post heading", excerpt: description("post excerpt"), content: [], featured_image: image } },
    { id: "fixture-fallback", slug: "fixture-fallback", status: "published",
      data: { title: "Fixture fallback title", excerpt: description("fallback excerpt"), content: [], featured_image: image } },
  ],
  projects: [
    { id: "fixture-project", slug: "fixture-project", status: "published",
      data: { title: "Fixture project heading", summary: description("project summary"), content: [], featured_image: image } },
    { id: "fixture-fallback-project", slug: "fixture-fallback-project", status: "published",
      data: { title: "Fixture project fallback", summary: description("fallback project summary"), content: [], featured_image: image } },
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

function createSeed(path) {
  const seed = {
    ...original,
    settings: site,
    taxonomies: original.taxonomies.map(({ terms, ...taxonomy }) => taxonomy),
    bylines: [],
    menus: original.menus.map((menu) => ({ ...menu, items: [] })),
    content: entries,
  };
  writeFileSync(path, JSON.stringify(seed));
}

function applySeo(path) {
  const db = new DatabaseSync(path);
  try {
    const insert = db.prepare("INSERT INTO _emdash_seo (collection, content_id, seo_title, seo_description) VALUES (?, ?, ?, ?)");
    for (const [collection, records] of Object.entries(entries)) {
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

async function verify(origin) {
  const routes = {
    "/": "home", "/about": "about", "/contact": "contact", "/pricing": "pricing",
    "/privacy-policy": "privacy-policy", "/pages/fixture-page": "fixture-page",
    "/posts/fixture-post": "fixture-post", "/projects/fixture-project": "fixture-project",
  };
  const sitemap = await (await fetch(new URL("/sitemap.xml", origin))).text();
  const paths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gs)].map((match) => new URL(match[1]).pathname);
  const expected = [...Object.keys(routes), "/posts", "/projects", "/posts/fixture-fallback", "/projects/fixture-fallback-project"];
  if (new Set(paths).size !== paths.length || expected.some((path) => !paths.includes(path))) {
    throw new Error("Fixture sitemap is missing a route or contains duplicates");
  }
  console.log("Fixture sitemap includes every route exactly once");
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
  console.log("/projects/fixture-fallback-project: entry title/summary fallback rendered");
}

const [action, value] = process.argv.slice(2);
if (!value) throw new Error("usage: node scripts/seo-fixture.mjs seed|seo|verify <path-or-origin>");
if (action === "seed") createSeed(value);
else if (action === "seo") applySeo(value);
else if (action === "verify") await verify(value);
else throw new Error(`Unknown fixture action: ${action}`);
