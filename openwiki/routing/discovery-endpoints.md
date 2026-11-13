---
type: routing subsystem
title: Discovery endpoints
description: The machine-facing surface both apps share — rss.xml, llms.txt, sitemap.xml, schema endpoints and schemamap/api-catalog, robots.txt, and taxonomy archives — all published-only with session-aware caching.
tags: [rss, llms-txt, sitemap, schema, robots, taxonomy, discovery]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-488219c6e201bfbefc66347a
    resource: repo://apps/marketing-site/src/pages/sitemap.xml.ts
  - id: openwiki-source-8cf077911c9df35aeccb8413
    resource: repo://packages/cms-helpers/src/discovery-handlers.ts
  - id: openwiki-source-5a47efe18ab2ca275d08f0eb
    resource: repo://packages/cms-helpers/src/discovery-response.ts
  - id: openwiki-source-bc4d766ccf1163382ec27f8a
    resource: repo://packages/cms-helpers/src/llms.ts
  - id: openwiki-source-25ab8d98f93b4107dab40657
    resource: repo://packages/cms-helpers/src/schema-collections.ts
  - id: openwiki-source-47a510e1a8f22f63dd8f5f9c
    resource: repo://packages/cms-helpers/src/taxonomy-archive.ts
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

`packages/cms-helpers/src/discovery-handlers.ts` and its siblings implement every discovery endpoint; each app's `src/pages/` wires thin route files to them. All content reads go through `runPublishedOnly` (live revisions even in editor sessions) and set Astro cache hints.

## The shared response policy — `discoveryResponse`

Worker responses can't rely on the static `public/_headers` file, so `discoveryResponse(response, cache, maxAge = 3600)` applies the policy at runtime: `Access-Control-Allow-Origin: *` always; `Cache-Control` becomes `no-store` on 5xx, `private, no-store` when the request carries an edit-mode/preview session (and route caching is disabled with `cache.set(false)` in both cases), otherwise `public, max-age=<maxAge>`. Shorter windows (e.g. 300s) are used where content changes faster.

## Feeds and maps

- **`rss.xml`** — the latest 20 published posts ordered by `published_at` desc, XML-escaped titles/excerpts, absolute post URLs from the resolved site identity, permaLink guids; `application/rss+xml`, 1-hour cache.
- **`llms.txt`** — two generators. `getLlmsTxt` (marketing) builds sections purely from the shared published-route map via `getPublishedRoutes`; `getGardenLlmsTxt` is the garden's legacy path enumerating collections directly (excluding projects) until the garden adopts published-route gating. Both render through `@jdevalk/astro-seo-graph`'s `renderLlmsTxt` with settings title/tagline, and return 500 text on failure rather than a half-empty file.
- **`sitemap.xml`** — each app's route builds the URL set from `getPublishedRoutes` (so unpublished content, empty archives, and drafts never appear), deduplicated and absolute.
- **`schema/[collection].json`** — JSON-LD for one public collection: published entries assembled with `@jamesryan/ui`'s `buildSiteGraph` plus `seo-graph-core` builders (`buildWebPage`/`buildArticle`), settings identity, `discoveryResponse` with a 60s window; unknown collection names 404 through the same policy.
- **`schemamap.xml` and `/.well-known/api-catalog`** — `@jdevalk/astro-seo-graph`'s `createSchemaMap`/`createApiCatalog` fed by `getSchemaCollections`: exactly the collections that currently have published entries, with each's latest `updatedAt` as lastModified, BlogPosting schema type for posts and WebPage otherwise, 300s cache.
- **`robots.txt`** — static policy rendered with the resolved site URL: allow all, sitemap references to `/sitemap.xml` and `/schemamap.xml`, and a `Content-Signal: ai-train=no, search=yes, ai-input=yes` header plus inline comment.

## Taxonomy archives

`getTaxonomyArchive("category" | "tag", slug, cache)` resolves the term (recursively through children), 404-ing unknown terms, then lists published posts with a `where: { [taxonomy]: term.slug }` filter ordered newest-first. For categories it also fetches each post's tags in one `getTermsForEntries` batch and returns bylines with each card — archive cards render through `@jamesryan/ui`'s `TaxonomyArchive`, schema-independent of either app's generated types. The taxonomy name must match the seed's exact `"name"` (`category`, `tag`).

## Where policy is decided

<!-- openwiki: broken internal link [/openwiki/routing/published-route-boundary.md] link "/openwiki/routing/published-route-boundary.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
What appears in discovery is decided entirely by the published-route rules in [Published-route boundary](/openwiki/routing/published-route-boundary.md); this layer only formats and caches. Verified previews and edit-mode requests see the same live content as anonymous visitors (only the cache headers differ), which is what the fixture tests in `packages/cms-helpers/test/discovery.test.mjs` and `feeds.test.mjs` assert.
