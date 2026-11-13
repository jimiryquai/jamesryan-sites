---
type: feature architecture
title: Shared content blocks and layout migration
description: How testimonials, pricing, faq, and team blocks read shared collections scoped by a page's service reference, and the two-step scripts that migrated legacy Portable Text content into layout blocks and retired the old field.
tags: [page-builder, shared-content, service-scoping, migration, emdash]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-17dcd0e24ddce64a1f13f6c3
    resource: repo://apps/marketing-site/src/components/page-builder/sources.ts
  - id: openwiki-source-ffef0119bd807432ddcdf94e
    resource: repo://packages/cms-helpers/src/service-content.ts
  - id: openwiki-source-39c86bf5b7bd2b546b9de5ee
    resource: repo://scripts/move-content-to-layout.mjs
  - id: openwiki-source-1675fda228e6ad7153081d81
    resource: repo://scripts/retire-pages-content.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

## Two scoping paths for shared content

Shared-content blocks (`testimonials`, `pricing`, `faq`, `team`) do not carry their data inline; they read the matching CMS collections, scoped by the rendering page's optional `service` reference. Two code paths implement that scoping:

- **Page-builder sources** (`apps/marketing-site/src/components/page-builder/sources.ts`) — the live path. `createSources(siteQuery)` wires the plugin's `createPricingSource` / `createTestimonialsSource` / `createFaqSource` / `createTeamSource` factories, each with `groupField: 'service'`, so the plugin queries with a group filter instead of the site post-filtering. Typed shape adapters (`pricingShape`, `testimonialShape`, `faqShape`, `teamShape`) map each generated collection row onto the package's block shape at one boundary, making collection/shape drift a type error. The `posts` source maps each post with tags (folded into row data via one `getTermsForEntries` call over the page of ids), bylines, image, date, and `readingTime` from `@jamesryan/cms-helpers`.
- **`packages/cms-helpers/src/service-content.ts`** — `getServiceEntries(collection, serviceSlug)` resolves service-linked content through **published references**: fetch the service entry; when it is published, page through the collection (`status: "published"`, `limit: 50`) and read every entry's `service` selection via `getEmDashReferences` — EmDash 1.4 has no reverse-reference collection filter, so entries beyond the first page are read too and unrelated entries cannot hide a match. The returned cache hint is the union of all tags plus the max `lastModified`.

## One read per request

`perRequestSource` wraps the posts source so the home route's featured-image preload and the rendered section share one collection read per request: inside a request context, reads memoize on the request object keyed by a canonical (sorted) serialization of the source context; outside requests (builds, tests) every call reads afresh. `SiteQuery` bundles the query boundary (`list`, `get`, plus `terms`) and is injectable so tests exercise the wiring without a database. The `get` seam also exposes legacy scalar `service` selections at the same place bound references resolve, merging cache hints when it fetches the service entry itself.

## The legacy-field migration

Pages previously stored their marketing content as Portable Text in a `content` field; the layout field replaced it in two steps, both scripts plan-by-default with `--apply` to write:

- **`scripts/move-content-to-layout.mjs`** converts each page's `content` marketing blocks into page-builder blocks (one mapper per `marketing.*` type — hero, cta, features, stats, comparison, testimonials, pricing, faq, team, document — the single home of the ten mappings). The mapping is conservative: a marketing field with no home in the target block stops that page with a named reason instead of being dropped, and plain Portable Text runs become one centered `prose` block whose leading heading becomes the section heading (heading-only runs are stopped, since a prose block needs content). Moves append to `layout`, leaving `content` in place.
- **`scripts/retire-pages-content.mjs`** clears and then deletes the pages `content` field once the move script plans nothing anywhere. Every refusal path is explicit: `--apply` refuses while any page is unmoved; publish uses the read-back revision only when that whole draft equals the planned cleared page; a published page with a pending draft publishes only when the live draft is exactly the cleared content; before the schema delete the page list is re-read and must still be migrated, clear, and draft-free. Plan mode always exits 0; `--apply` exits 1 when it refuses or a write fails; a rerun against an already-retired site is a no-op. The known race window is documented in the script: entry writes are `_rev`-fenced but the field DELETE has no collection revision, so a write arriving after the final read can race it.

Block schema fields themselves stay optional — the plugin's publish policy enforces required fields at publish time, which is why the migration scripts could move content without schema-level requirements.
