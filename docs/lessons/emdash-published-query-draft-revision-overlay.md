---
type: Lesson
title: EmDash published queries still overlay pending draft revisions during editMode and preview sessions
description: Calling getEmDashCollection with status "published" filters SQL rows by published status, but EmDash 1.5 still overlays row.draft_revision_id when editMode or preview is active in getRequestContext().
tags: [emdash, caching, discovery, security]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T22:04:00Z }
sources:
  - id: pr-44-45
    resource: https://github.com/jimiryquai/jamesryan-sites/pull/45
  - id: content-query
    resource: packages/cms-helpers/src/content-query.ts
---

# Context
While fixing discovery feeds (`/rss.xml`, `/sitemap.xml`, `/llms.txt`, `/schema/*.json`, `/schemamap.xml`) for Ticket `32-a552c031`, passing `{ status: "published" }` to `getEmDashCollection` excluded purely draft entries, and `discoveryResponse` marked session/preview responses `Cache-Control: private, no-store`.[^pr-44-45] However, cross-family review caught that in EmDash 1.5 (`emdash/src/query.ts` and `emdash/src/loader.ts`), when an entry is already `published` *and* has an unpublished revision (`draft_revision_id`), `loadDraftRevisions` overlays that pending draft snapshot whenever `getRequestContext()` has `editMode === true` or `preview?.collection === type`, causing published-only feeds to emit unapproved draft titles, descriptions, or slugs during preview/edit sessions.[^content-query]

# Lesson
Filtering by `{ status: "published" }` alone does not guarantee published-only content in EmDash 1.5 when `editMode` or `preview` is active in `AsyncLocalStorage`; published-only discovery queries must clear `editMode` and `preview` inside a scoped `runWithContext` wrapper while preserving the outer request context for `Cache-Control: private, no-store` response headers.[^pr-44-45]

# How to apply
- Route published-only collection and feed queries through `runPublishedOnly` (`runWithContext({ ...ctx, editMode: false, preview: undefined }, fn)`) in `@jamesryan/cms-helpers`.
- Read the outer `getRequestContext()` in `discoveryResponse` so authenticated/preview requests still receive `Cache-Control: private, no-store` and `Astro.cache.set(false)`.
- Test published discovery feeds against published entries that carry a pending `draft_revision_id` under active preview/edit sessions, not just standalone `status: "draft"` entries.

[^pr-44-45]: PR #44 and PR #45 (`b6ec757`, Ticket `32-a552c031` cross-family review)
[^content-query]: `packages/cms-helpers/src/content-query.ts` (`runPublishedOnly`)
