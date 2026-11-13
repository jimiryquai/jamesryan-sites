---
type: security boundary
title: Published-route boundary
description: The anonymous published-only rule for CMS content — one request-authorized lookup for rendering, a published-only map for discovery, URL mapping and its inverse, and how preview/edit-mode isolation works.
tags: [published-routes, access-control, previews, url-mapping, emdash]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-8ec39cf530c7e0ee9b9f81de
    resource: repo://apps/marketing-site/src/utils/content-markdown.ts
  - id: openwiki-source-04a0df673605488ddb1bb2d2
    resource: repo://docs/published-routes.md
  - id: openwiki-source-2b5b66b5893be8efad577b7f
    resource: repo://packages/cms-helpers/src/content-query.ts
  - id: openwiki-source-9dac9093e054889747f046a6
    resource: repo://packages/cms-helpers/src/content-url.ts
  - id: openwiki-source-7d73af78cfa2b3d1acabc68b
    resource: repo://packages/cms-helpers/src/og.ts
  - id: openwiki-source-7ae3195370847317b4e38021
    resource: repo://packages/cms-helpers/src/published-routes.ts
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

`packages/cms-helpers/src/published-routes.ts` owns the rule (`docs/published-routes.md` documents it; the source is authoritative): **for anonymous visitors, a content route exists only when its CMS entry is published.** Two functions enforce it in opposite directions.

## `getPublishedRoute(path, cache, { references })` — rendering

One targeted, request-authorized, cache-hinted lookup per route:

1. Archive paths (`/posts`, `/projects`) resolve only when the collection has at least one published entry (a `limit: 1` published probe).
2. Otherwise `resolveContentPath(path)` maps the URL to `{ collection, slug }` and `getEmDashEntry` loads the entry — **EmDash decides what the request may see**: verified draft previews and edit-mode sessions receive drafts, and rendering simply trusts the entry returned. Routes pass their reference selection (`references: { service: true }`) into the same call, reading `entry.references` without a second entry read; the single cache hint covers the whole lookup.
3. Missing or unpublished content returns `null`, and routes rewrite to Astro's 404.

Every HTML content route (`pages/[slug]`, `posts/[slug]`, `projects/[slug]`, `[...slug]`) and every Markdown `.md` twin goes through this adapter; the Markdown twins map their decoded params back to encoded paths with `getMarkdownContentPath` first (`home` is the `.md` spelling of `/`).

## `getPublishedRoutes(cache)` — discovery

The full map for `sitemap.xml` and `llms.txt`: enumerates all published entries of every public collection plus the existing archive paths. Under `runPublishedOnly` (from `content-query.ts`), the enumeration always runs against **live revisions with edit-mode/preview stripped**, so discovery stays published-only even when the request comes from an editor session — the same session sees drafts only through the single-entry path above. `getSchemaCollections` applies the same wrapper.

## URL mapping and its inverse — `content-url.ts`

`PUBLIC_COLLECTIONS` names the public collections and their discovery labels: `pages` → Pages, `posts` → Posts, `projects` → Work.

- `getContentPath`: the `pages` entry `home` maps to `/`; `about`, `contact`, `pricing`, `privacy-policy` are top-level (`/about`, …); every other page is `/pages/<encoded slug>`. Posts and projects map to `/<collection>/<encoded slug>`.
- `resolveContentPath` is the strict inverse: it rejects aliases and malformed encodings by re-encoding the decoded slug and requiring equality with the original path (`decodeURIComponent` failures return `null`), so percent-encoding tricks cannot reach entries outside their canonical URL.
- `getMarkdownContentPath` mirrors the mapping for decoded `.md` params.

## Preview isolation

<!-- openwiki: broken internal link [/openwiki/routing/discovery-endpoints.md] link "/openwiki/routing/discovery-endpoints.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/routing/opengraph-images.md] link "/openwiki/routing/opengraph-images.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
EmDash 1.5's entry cache hints carry invalidation tags including for previews, but do not mark previews private themselves; its preview middleware disables Astro route caching (`cache.set(false)`) for any `_preview` parameter and sets `Cache-Control: private, no-store` on verified previews. The OG image routes and the Markdown twins (`discoveryResponse`) enforce the same private/no-store rule on their session-specific responses, and the rendered-SEO fixture repeats the anonymous request afterwards to verify isolation. Category/tag archives and search policy live in [Discovery endpoints](/openwiki/routing/discovery-endpoints.md); image generation follows the identical rule in [OpenGraph image routes](/openwiki/routing/opengraph-images.md).
