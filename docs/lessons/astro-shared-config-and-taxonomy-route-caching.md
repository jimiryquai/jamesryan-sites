---
type: Lesson
title: Keep Astro config factories inside Vite's config bundle, run Astro.rewrite before component streaming, and attach taxonomy cache tags
description: Bare workspace specifiers in astro.config.mjs are externalized by Vite and fail on uncompiled TypeScript plugin packages, nested Astro components cannot call Astro.rewrite after streaming starts, and taxonomy archives need explicit emdash:taxonomy:* cache hints.
tags: [astro, emdash, caching, monorepo]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T22:42:00Z }
sources:
  - id: pr-46
    resource: https://github.com/jimiryquai/jamesryan-sites/pull/46
  - id: astro-config
    resource: packages/astro-config/index.mjs
  - id: taxonomy-archive
    resource: packages/cms-helpers/src/taxonomy-archive.ts
---

# Context
While consolidating `astro.config.mjs` and `{category,tag}/[slug].astro` across `apps/marketing-site` and `apps/digital-garden` for Ticket `34-688a3b6c`, three subtle platform traps surfaced during implementation and cross-family review:[^pr-46]
1. Importing the shared config factory via a bare workspace specifier (`@jamesryan/astro-config`) caused Astro/Vite's config loader to externalize it, handing uncompiled TypeScript plugin entrypoints (`@jdevalk/emdash-plugin-seo/src/index.ts`, `emdash-plugin-code-block-pro/src/index.ts`) directly to Node's native loader where they failed.[^astro-config]
2. Returning `Astro.rewrite("/404")` inside a shared `<TaxonomyArchive />` child component threw `ResponseSentError` at runtime because the parent page had already started streaming headers before rendering the child component.
3. Querying `getEmDashCollection("posts", { where: { [taxonomy]: slug } })` only registers `{ tags: ["posts"] }` on `Astro.cache`, whereas EmDash admin term renames and deletes invalidate `emdash:taxonomy:{category,tag}` — and `getTerm(taxonomy, slug)` defaults to `includeCounts: true`, running an unused `UNION ALL` count query.[^taxonomy-archive]

# Lesson
In an Astro + EmDash monorepo: (1) import shared `astro.config.mjs` factories via a relative path (`../../packages/astro-config/index.mjs`) while keeping dependencies declared in `packages/astro-config/package.json` for pnpm strictness and passing `appRootUrl: import.meta.url` for app-relative plugin paths; (2) execute `Astro.rewrite("/404")` in top-level page frontmatter before rendering shared layout/archive components; and (3) resolve taxonomy terms via `getTaxonomyTermsWithCacheHint(name, { includeCounts: false })` and pass its `cacheHint` (plus `tag` taxonomy `cacheHint` when rendering post-card tag badges) to `Astro.cache.set()`.[^pr-46]

# How to apply
- Import `createSiteConfig` via `../../packages/astro-config/index.mjs` in each app's `astro.config.mjs` and pass `appRootUrl: import.meta.url`.
- Resolve archive data (`const archive = await getTaxonomyArchive(...)`) and `if (!archive) return Astro.rewrite("/404")` in `src/pages/{category,tag}/[slug].astro` before rendering `<TaxonomyArchive />`.
- Register `getTaxonomyTermsWithCacheHint(taxonomy, { includeCounts: false }).cacheHint` on `Astro.cache` alongside collection `cacheHint`s.

[^pr-46]: PR #46 (`1e7f91b`, Ticket `34-688a3b6c` implementation and cross-family review)
[^astro-config]: `packages/astro-config/index.mjs` and `apps/*/astro.config.mjs`
[^taxonomy-archive]: `packages/cms-helpers/src/taxonomy-archive.ts`
