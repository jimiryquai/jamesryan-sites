#!/usr/bin/env node
/**
 * Check a rendered marketing site's .md routes against its seed: every
 * published page serves its layout as Markdown (shared-content blocks
 * including the items their sources read), drafts stay 404, and posts keep
 * their Portable Text markdown envelope. Expectations come from the seed
 * file, not from the renderer, so a regression in either direction fails.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pageMarkdownPath, publishedEntryPath } from "./published-path.mjs";

// The page builder's shared-content block labels, and where each reads items.
const SHARED_BLOCKS = {
  faq: { label: "FAQ", collection: "faqs", texts: (data) => [data.question, data.answer] },
  team: { label: "Team", collection: "team", texts: (data) => [data.name, data.role] },
  testimonials: { label: "Testimonials", collection: "testimonials", texts: (data) => [data.quote, data.author] },
  pricing: { label: "Pricing", collection: "pricing", texts: (data) => [data.name] },
};
// The posts block's default count, mirrored from its definition.
const POSTS_DEFAULT_COUNT = 4;

function textValue(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function imageAlt(block) {
  return textValue(block.alt)
    ?? textValue(block.asset?.alt)
    ?? textValue(block.asset?.$media?.alt)
    ?? "";
}

/** A URL the seed itself names. Resolved media ids are not in the seed, so a
 * `$media` file is not required byte-for-byte; the alt image marker is. */
function stableImageUrl(block) {
  return textValue(block.url) ?? textValue(block.src) ?? textValue(block.value)
    ?? (typeof block.asset === "string" ? textValue(block.asset) : undefined)
    ?? textValue(block.asset?.url) ?? textValue(block.asset?.src) ?? textValue(block.asset?.previewUrl);
}

/** Fenced code, blockquote markers and Markdown images a `.md` route must include. */
function portableTextMarkers(content) {
  const markers = [];
  for (const block of content ?? []) {
    if (!block || typeof block !== "object") continue;
    if (block._type === "code-block-pro" || block._type === "code") {
      const language = typeof block.language === "string" ? block.language : "";
      const code = typeof block.code === "string" ? block.code : "";
      const body = code.endsWith("\n") ? code : `${code}\n`;
      markers.push(`\`\`\`${language}\n${body}\`\`\``);
    } else if (block._type === "image") {
      const alt = imageAlt(block);
      const url = stableImageUrl(block);
      if (url) markers.push(`![${alt}](${url})`);
      else if (alt) markers.push(`![${alt}](`);
    } else if (block._type === "block" && block.style === "blockquote") {
      const text = (block.children ?? []).map((child) => child?.text ?? "").join("");
      if (text) markers.push(text.split("\n").map((line) => `> ${line}`).join("\n"));
    }
  }
  return markers;
}

/** The published posts a posts block reads, newest first. A fresh seed stamps
 * every published entry with its seeding time, so the collection's newest-first
 * order (`published_at` desc, monotonic ids desc) is the seed's array order
 * reversed. */
function postsBlockTexts(block, collections) {
  const published = (collections.posts ?? []).filter((entry) => entry.status === "published");
  const count = typeof block.count === "number" && block.count > 0 ? block.count : POSTS_DEFAULT_COUNT;
  return published.slice().reverse().slice(0, count).map((entry) => {
    const slug = entry.slug ?? entry.id;
    return `- [${entry.data?.title ?? entry.id}](/posts/${slug})`;
  });
}

/** Plain text a reader should find in the Markdown for one layout block. */
function blockTexts(block, collections, pageService) {
  const data = block;
  if (data._type === "posts") return postsBlockTexts(block, collections);
  if (SHARED_BLOCKS[data._type]) {
    const { label, collection, texts } = SHARED_BLOCKS[data._type];
    const entries = (collections[collection] ?? [])
      .filter((entry) => data.scope !== "page" || !pageService || entry.data?.service === pageService);
    return [`## ${label}`, ...entries.flatMap((entry) => texts(entry.data ?? {}))];
  }
  const texts = [data.heading, data.eyebrow, data.eyebrow_action, data.body, data.subheadline];
  for (const link of data.links ?? []) texts.push(link.label && link.url ? `- [${link.label}](${link.url})` : link.label);
  for (const item of data.items ?? []) texts.push(item.title, item.description, item.value, item.label);
  for (const column of data.columns ?? []) texts.push(column.label);
  for (const row of data.rows ?? []) texts.push(row.name, row.first_value, row.second_value, row.third_value);
  for (const pt of data.content ?? []) {
    if (pt._type === "block") for (const child of pt.children ?? []) texts.push(child.text);
  }
  texts.push(...portableTextMarkers(data.content));
  return texts;
}

async function main(origin, seedPath, evidenceDir) {
  const seed = JSON.parse(readFileSync(seedPath, "utf8"));
  const collections = seed.content ?? {};
  const siteTitle = seed.settings?.title || "James Ryan";
  const envelope = (title) => [`# ${title}`, `*Published on ${siteTitle}*`];
  let errors = 0;
  let checked = 0;
  const fetchMarkdown = async (path) => {
    const response = await fetch(new URL(path, origin));
    const body = await response.text();
    if (evidenceDir) writeFileSync(join(evidenceDir, `${path.replaceAll("/", "_").slice(1)}.md`), body);
    return { response, body };
  };
  const expect = (path, ok, rule) => {
    if (!ok) {
      console.error(`${path}: ${rule}`);
      errors++;
    }
  };

  for (const entry of collections.pages ?? []) {
    const path = pageMarkdownPath(entry.slug);
    const title = entry.data?.title ?? entry.id;
    if (entry.status !== "published") {
      checked++;
      const { response } = await fetchMarkdown(path);
      expect(path, response.status === 404, `draft page must not serve markdown, got HTTP ${response.status}`);
      continue;
    }
    checked++;
    const { response, body } = await fetchMarkdown(path);
    expect(path, response.status === 200, `HTTP ${response.status}`);
    expect(path, (response.headers.get("content-type") ?? "").startsWith("text/markdown"),
      `content type ${response.headers.get("content-type")}`);
    for (const text of envelope(title)) expect(path, body.includes(text), `markdown is missing ${JSON.stringify(text)}`);
    for (const block of entry.data?.layout ?? []) {
      for (const text of blockTexts(block, collections, entry.data?.service)) {
        if (text !== undefined && text !== null && `${text}`.length > 0) {
          expect(path, body.includes(`${text}`), `markdown is missing ${JSON.stringify(`${text}`)}`);
        }
      }
    }
  }

  for (const entry of collections.posts ?? []) {
    if (entry.status !== "published") continue;
    checked++;
    const path = `${publishedEntryPath("posts", entry.slug)}.md`;
    const { response, body } = await fetchMarkdown(path);
    expect(path, response.status === 200, `HTTP ${response.status}`);
    for (const text of [...envelope(entry.data?.title ?? entry.id), ...portableTextMarkers(entry.data?.content)]) {
      expect(path, body.includes(text), `markdown is missing ${JSON.stringify(text)}`);
    }
  }

  for (const entry of collections.projects ?? []) {
    if (entry.status !== "published") continue;
    checked++;
    const path = `${publishedEntryPath("projects", entry.slug)}.md`;
    const { response, body } = await fetchMarkdown(path);
    expect(path, response.status === 200, `HTTP ${response.status}`);
    for (const text of [...envelope(entry.data?.title ?? entry.id), ...portableTextMarkers(entry.data?.content)]) {
      expect(path, body.includes(text), `markdown is missing ${JSON.stringify(text)}`);
    }
  }

  console.log(`${checked} markdown routes checked at ${origin}`);
  return errors;
}

try {
  const [origin, seedPath, evidenceDir] = process.argv.slice(2);
  if (!origin || !seedPath) throw new Error("usage: node scripts/check-rendered-markdown.mjs <origin> <seed> [evidence-dir]");
  if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });
  if (await main(origin, seedPath, evidenceDir)) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
