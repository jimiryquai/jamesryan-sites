---
type: design system
title: Shared UI design system
description: The @jamesryan/ui package and @jamesryan/cms-helpers responsive media contract — olive palette tokens, theme switching, Base.astro LCP image preloads, IMAGE_SLOTS across cards and hero routes, and OG gradient extraction.
tags: [ui, design-system, tailwind, palette, theming, responsive-images, lcp, wcag, accessibility]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-16T14:08:20.656Z
sources:
  - id: openwiki-source-dec82b36c6aadc3f9994a16c
    resource: repo://apps/marketing-site/src/components/page-builder/featured-post-preload.ts
  - id: openwiki-source-545f10c35aa2534705debe48
    resource: repo://apps/marketing-site/src/styles/palette.ts
  - id: openwiki-source-3016e832156022d201cdcdac
    resource: repo://apps/marketing-site/test/featured-post-preload.test.mjs
  - id: openwiki-source-227b322ca57dd1bdaedd1ed5
    resource: repo://packages/cms-helpers/src/responsive-images.ts
  - id: openwiki-source-a89b49e4b50a12dfda1999b3
    resource: repo://packages/ui/package.json
  - id: openwiki-source-850aecda5c796e187485fb66
    resource: repo://packages/ui/src/components/Base.astro
  - id: openwiki-source-bd3fb86ce572d5ba64577407
    resource: repo://packages/ui/src/components/theme-init.js
  - id: openwiki-source-fc2e90791501e5671cc274bc
    resource: repo://packages/ui/src/components/ThemeSwitcher.astro
  - id: openwiki-source-ebec531f50ff51fc3f00a24e
    resource: repo://packages/ui/src/index.ts
  - id: openwiki-source-1b5ed3361e05d79ca2d13d0f
    resource: repo://packages/ui/src/styles/globals.css
  - id: openwiki-source-a91807442c900a8e25c15aaa
    resource: repo://packages/ui/src/styles/palette.css
  - id: openwiki-source-11cf3ce893fae68ed07d4bf2
    resource: repo://scripts/check-accessibility.mjs
generated: { by: "claude-code", at: "2026-11-16T14:08:20.656Z" }
---

`@jamesryan/ui` is the shared look of both apps. Apps import its styles (`./styles/palette.css`, `./styles/globals.css`), components (`./components/*`), assets, and the `./seo-graph` helper; the factory's font configuration gives each app its display face — Instrument Serif on marketing, Familjen Grotesk on the garden — over the shared Inter sans.

## Palette and tokens

`src/styles/palette.css` defines the olive scale as Tailwind v4 `@theme` tokens in OKLCH (`--color-olive-50` … `--color-olive-900`), with olive-950 as a hex fallback and `--social-background` — the OG card gradient — deliberately in **sRGB**, because Satori cannot parse OKLCH. Each app's `src/styles/palette.ts` extracts that gradient with a regex and hands it to the OG image routes ([OpenGraph image routes](../routing/opengraph-images.md)). `globals.css` imports Tailwind and the palette, declares the `--font-display`/`--font-sans` variables, and layers project prose styling (`.project-prose`) whose dark rules rely on the theme variant below. Palette changes belong in this package and must keep **WCAG 2.2 AA contrast in both light and dark modes** — enforced in CI by the axe scan (`wcag2a`–`wcag22aa` tags, light+dark, serious/critical fail) in [Verification and quality checks](../operations/verification-suite.md).

## Theming without a flash

`src/components/theme-init.js` is an inline `<head>` script that reads the `theme` cookie and applies `.light`/`.dark` classes plus `colorScheme` **before the body can paint**. The exposed `window.siteTheme` API validates values (`light`/`dark`/`system`), persists explicit choices as a one-year cookie (system clears it), re-applies, and dispatches `themechange`. The rule: explicit visitor choice wins over the system preference — `globals.css`'s `@custom-variant dark` matches both `.dark` and cookie-less system dark (`:root:not(.light)` under `prefers-color-scheme: dark`), so styles must not gate on `.dark` alone.

`ThemeSwitcher.astro` renders the accessible control: a button with `aria-haspopup="menu"`/`aria-expanded`, a `role="menu"` popup of `menuitemradio` options (Light/Dark/System with Phosphor icons), and an sr-only live description of the current choice — the exact behavior `scripts/check-theme.mjs` drives keyboard-only with video recording.

## Responsive media slots and LCP preloads

`@jamesryan/cms-helpers` (`packages/cms-helpers/src/responsive-images.ts`) defines the shared display slots and preload resolver that keep EmDash `<Image />` renders and `<head>` preloads in sync:

- **`IMAGE_SLOTS`** — four display presets with fixed `width`, `height`, and responsive `sizes`:
  - `card` (`800×500`, `(min-width: 1024px) 384px, (min-width: 640px) 50vw, calc(100vw - 3rem)`) — spread onto `<Image {...IMAGE_SLOTS.card} />` in `PostCard.astro` and `ProjectCard.astro`.
  - `featuredPost` (`1200×750`, `(min-width: 1024px) 720px, calc(100vw - 3rem)`) — used with `priority` on the featured hero in marketing's `PostsFeaturedGrid.astro`, `apps/marketing-site/src/pages/posts/index.astro`, and `apps/digital-garden/src/pages/index.astro`.
  - `postHero` (`1200×750`, `(min-width: 1280px) 1200px, calc(100vw - 3rem)`) — used with `priority` on `/posts/[slug].astro` in both apps.
  - `projectHero` (`1280×720`, `(min-width: 1280px) 1200px, calc(100vw - 3rem)`) — used with `priority` on `/projects/[slug].astro` in both apps.
- **`resolveResponsiveImagePreload(getImage, image, options)`** — resolves the exact Astro `getImage` transform (`layout: "constrained"`, `fit: "cover"`, `position: "center"`) for same-origin local media (`src` or `/_emdash/api/media/file/<storageKey|id>`) and returns `{ href, imagesrcset, imagesizes }`. It safely returns `{ href: "" }` for empty or malformed media identifiers and falls back to the raw `href` without calling the optimizer for external providers without a `src`, protocol-relative or backslash-escaped paths, cross-origin URLs, missing dimensions, or optimizer errors.
- **`resolveFeaturedPostPreload(layout, group, origin)`** (`apps/marketing-site/src/components/page-builder/featured-post-preload.ts`) — migrates the page layout blocks, locates the first `posts` block with the `featured-grid` variant, reads `sources.posts` (memoized per request so `/` queries posts only once), finds the first post with an image, and resolves its `IMAGE_SLOTS.featuredPost` preload.
- **Single `<head>` preload emission** — `packages/ui/src/components/Base.astro` accepts `preloadImage?: ResponsiveImagePreload` (forwarded by both apps' `src/layouts/Base.astro` wrappers through `ComponentProps<typeof SharedBase>`) and is the sole place that renders `<link rel="preload" as="image" href={preloadImage.href} imagesrcset={preloadImage.imagesrcset} imagesizes={preloadImage.imagesizes} fetchpriority="high" />`.
- **Byline avatars and static `/about` avatar** — small author avatars in `PostCard.astro`, `PostsFeaturedGrid.astro`, and `/posts/[slug].astro` render raw `/_emdash/api/media/file/${credit.byline.avatarMediaId}` `<img>` tags marked with `data-byline-avatar`. On `/about` (`apps/marketing-site/src/pages/about.astro`), the static `/images/avatar.webp` fallback hero declares `width="500"`, `height="500"`, `fetchpriority="high"`, and `decoding="async"`. Both contracts are enforced by `apps/marketing-site/test/featured-post-preload.test.mjs` and `scripts/check-rendered-media.mjs`.

## Component vocabulary

- `Base.astro` — the shared page chrome both apps wrap every route in: site identity from settings, menus, OG/meta emission, optional `preloadImage` link emission, and the theme bootstrap.
- `sections/` — composed marketing sections (hero, feature, pricing tiers, testimonials, teams, stats, navbars, footers) that page-builder section components build on.
- `elements/` — primitives (buttons, headings, containers, forms, logos, screenshots).
- `PostCard`, `ProjectCard`, `TaxonomyArchive` — content cards (wired to `IMAGE_SLOTS.card`) and the taxonomy archive grid used by category/tag routes.
- `icons/` — inline Astro icons; `assets/` — committed logos and screenshots.
- `src/utils/` — `og-image` (shared OG helpers), `page-fragments`, and `seo-graph` (the `buildSiteGraph` JSON-LD assembler the schema endpoints use).

The index re-exports `Base`, `PostCard`, and `ProjectCard`; other components are imported by path through the package exports. Page-builder sections in the apps compose these primitives rather than restyling ([Page builder block registry](../page-builder/block-registry.md)).
