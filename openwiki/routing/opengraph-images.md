---
type: routing subsystem
title: OpenGraph image routes
description: The /og/* PNG routes both apps share — workers-og Satori cards with embedded Inter fonts, published-entry gating for anonymous requests, session-aware cache headers, and bounded caching.
tags: [opengraph, og-images, workers-og, satori, caching]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-c3b418b39da4b1f0a8cfd8ae
    resource: repo://apps/marketing-site/src/pages/og/%5B...slug%5D.png.ts
  - id: openwiki-source-8ec39cf530c7e0ee9b9f81de
    resource: repo://apps/marketing-site/src/utils/content-markdown.ts
  - id: openwiki-source-47921affed18ebd8bb559d63
    resource: repo://packages/cms-helpers/package.json
  - id: openwiki-source-43bf4f09954736544c00b2d8
    resource: repo://packages/cms-helpers/scripts/embed-og-fonts.mjs
  - id: openwiki-source-7d73af78cfa2b3d1acabc68b
    resource: repo://packages/cms-helpers/src/og.ts
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

Both apps expose `/og/<collection>/<slug>.png` (posts, projects, pages) and `/og/default.png`, rendered by one builder: `getOgEntryImage` / `getOgSiteImage` in `packages/cms-helpers/src/og.ts`, wired through thin route files that supply each app's `socialBackground` gradient from its palette (`apps/*/src/styles/palette.ts`). Base.astro emits these URLs as the social meta images.

## Rendering: Satori VNodes, not HTML

Cards are built as plain-JS **VNode trees** (a tiny `div(style, children)` helper where every element is `display: flex`), passed to workers-og's `ImageResponse` (1200×630). This is deliberate: workers-og's HTMLRewriter path does not decode entities — an escaped `&amp;` would render literally — while a VNode hands exact string glyphs straight to Satori with no parser and no injection surface. The card layout is an olive-gradient background (per-app `socialBackground`), an uppercase site-title eyebrow, the entry's 60px title (clamped with hidden overflow), and a footer with the excerpt/summary and a host badge pill.

## Fonts travel in the bundle

`scripts/embed-og-fonts.mjs` regenerates `src/og-fonts.ts` from `@fontsource/inter`'s latin **WOFF1** files for weights 400/600/700 — Satori's fontkit cannot read WOFF2 — base64-embedded so rendering makes **zero outbound requests**; `--check` (run in cms-helpers typecheck) fails when the committed module is stale after a font bump. Font data decodes once per isolate and is cached.

## Authorization and caching

The entry route splits the slug at its first `/`, matching the collection prefix by scanning the known list (a plain-object map would match prototype keys like `constructor` and 500 downstream), then loads the entry with `getEmDashEntry`:

- **Anonymous requests** render only `status: "published"` entries; anything else — unknown prefix, missing slug, unpublished entry — 404s with `public, max-age=60`.
- **Verified previews and edit mode** (`isSessionRender`) may render drafts, with `Cache-Control: private, no-store` and `cache.set(false)` — the same rule as the markdown twins in `apps/*/src/utils/content-markdown.ts`. EmDash 1.5's preview middleware already disables route caching for `_preview` requests; the handler enforces it again so the session-specific PNG can never reach a shared cache.
- Published responses carry `public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`, and both the entry's and the site settings' cache hints are set — never `immutable`, since content can change.

`/og/default.png` is the pure site card: settings title and tagline (falling back to per-app `defaultTitle`/`defaultDescription`), never invented copy. `packages/cms-helpers/test/og.test.mjs` covers the gating and header matrix.
