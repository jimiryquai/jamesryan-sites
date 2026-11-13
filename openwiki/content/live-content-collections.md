---
type: content architecture
title: Live content collections
description: The _emdash live collection, EmDash's generated per-app types, and the query/cache-hint/reference contract every content route in both apps depends on.
tags: [emdash, astro, content-collections, cache-hints, types]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-ba3ced323b1aecaad015f3d7
    resource: repo://apps/digital-garden/emdash-env.d.ts
  - id: openwiki-source-3d21989964b8080954f80b80
    resource: repo://apps/digital-garden/src/live.config.ts
  - id: openwiki-source-cb6ae22cb5bd83167c99decb
    resource: repo://apps/marketing-site/emdash-env.d.ts
  - id: openwiki-source-c30282be9a1a4864ab62bea5
    resource: repo://apps/marketing-site/src/live.config.ts
  - id: openwiki-source-a4b35bc4bde3ca59cffd8a8b
    resource: repo://apps/marketing-site/src/pages/posts/%5Bslug%5D.astro
  - id: openwiki-source-2b5b66b5893be8efad577b7f
    resource: repo://packages/cms-helpers/src/content-query.ts
  - id: openwiki-source-9dac9093e054889747f046a6
    resource: repo://packages/cms-helpers/src/content-url.ts
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

## The loader

Each app's `src/live.config.ts` is deliberately identical boilerplate that must stay unchanged: it defines one Astro live collection named `_emdash` whose loader is `emdashLoader()` from `emdash/runtime`. This is the only bridge between Astro's content layer and the D1-backed CMS — routes never read the database directly, they call EmDash's query API which the loader's types back.

EmDash generates each app's `emdash-env.d.ts` on dev server start ("Do not edit manually"). It contains one data interface per seed collection (`Faq`, `Page`, `Post`, `Pricing`, `Project`, `Service`, `Team`, `Testimonial`), unions of collection keys, and — on marketing, which seeds `blockTypes` — versioned Portable Text block interfaces (`PageLayoutHeroV1Block` … `PageLayoutPostsV1Block`) unioned into `PageLayoutBlock`, plus a `Page` interface whose `layout` field uses that union. The garden's generated file is smaller because its schema has no layout blocks.

## Query API and the cache-hint contract

Routes query through `getEmDashCollection(collection, { status, limit, cursor, orderBy })` and `getEmDashEntry(collection, slug, { references })`. Every result carries `error` (thrown by callers) and a `cacheHint`. The house rule: **every route that queries content calls `Astro.cache.set(cacheHint)`** — usually through the `RequestCache` shape `{ enabled, set }` that `@jamesryan/cms-helpers` helpers accept (`Astro.cache` satisfies it directly). Omitting the hint would leave server-rendered CMS pages uncacheable or stale.

`packages/cms-helpers/src/content-query.ts` adds two patterns on top:

- `getPublishedEntries` paginates a collection with `limit: 100` + `nextCursor`, forcing `status: "published"` and setting the cache hint after each page.
- `runPublishedOnly` inspects the ambient request context (`getRequestContext()`); when a session carries `editMode` or `preview`, it re-runs the query under `runWithContext({ ...context, editMode: false, preview: undefined })`, so **discovery endpoints always enumerate live revisions even inside an editor session** while single-entry rendering keeps its authorization.

## Identity and reference conventions

- `entry.id` is the URL slug; `entry.data.id` is the database ULID. Calls like `getEntryTerms` or `getTermsForEntries` (used for post taxonomy footers) take the database id.
- A route rendering referenced content passes its selection — `references: { service: true }` — into the same `getEmDashEntry`/`getPublishedRoute` call and reads `entry.references`, one entry read per route with one cache hint covering the whole lookup.
- Route params arrive encoded; routes decode with `decodeSlug(Astro.params.slug)` and re-encode when mapping paths (`getMarkdownContentPath`).
- Image fields are `{ src, alt }` objects rendered with `<Image image={...} />` from `emdash/ui`; `src` may be a relative `/_emdash/api/media/file/<storageKey>` URL backed by R2.

<!-- openwiki: broken internal link [/openwiki/content/content-model-and-seeds.md] link "/openwiki/content/content-model-and-seeds.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/routing/published-route-boundary.md] link "/openwiki/routing/published-route-boundary.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
The typed collection surface these queries consume is defined by the seeds ([Content model and seeds](/openwiki/content/content-model-and-seeds.md)); which entries an anonymous visitor may see is decided by [Published-route boundary](/openwiki/routing/published-route-boundary.md).
