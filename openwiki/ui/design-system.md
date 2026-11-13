---
type: design system
title: Shared UI design system
description: The @jamesryan/ui package — olive palette tokens with WCAG 2.2 AA contrast, cookie-persisted theme switching that never flashes, the section/element component vocabulary, and how apps pull the shared gradient into OG images.
tags: [ui, design-system, tailwind, palette, theming, wcag, accessibility]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-545f10c35aa2534705debe48
    resource: repo://apps/marketing-site/src/styles/palette.ts
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
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

`@jamesryan/ui` is the shared look of both apps. Apps import its styles (`./styles/palette.css`, `./styles/globals.css`), components (`./components/*`), assets, and the `./seo-graph` helper; the factory's font configuration gives each app its display face — Instrument Serif on marketing, Familjen Grotesk on the garden — over the shared Inter sans.

## Palette and tokens

<!-- openwiki: broken internal link [/openwiki/routing/opengraph-images.md] link "/openwiki/routing/opengraph-images.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/operations/verification-suite.md] link "/openwiki/operations/verification-suite.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
`src/styles/palette.css` defines the olive scale as Tailwind v4 `@theme` tokens in OKLCH (`--color-olive-50` … `--color-olive-900`), with olive-950 as a hex fallback and `--social-background` — the OG card gradient — deliberately in **sRGB**, because Satori cannot parse OKLCH. Each app's `src/styles/palette.ts` extracts that gradient with a regex and hands it to the OG image routes ([OpenGraph image routes](/openwiki/routing/opengraph-images.md)). `globals.css` imports Tailwind and the palette, declares the `--font-display`/`--font-sans` variables, and layers project prose styling (`.project-prose`) whose dark rules rely on the theme variant below. Palette changes belong in this package and must keep **WCAG 2.2 AA contrast in both light and dark modes** — enforced in CI by the axe scan (`wcag2a`–`wcag22aa` tags, light+dark, serious/critical fail) in [Verification and quality checks](/openwiki/operations/verification-suite.md).

## Theming without a flash

`src/components/theme-init.js` is an inline `<head>` script that reads the `theme` cookie and applies `.light`/`.dark` classes plus `colorScheme` **before the body can paint**. The exposed `window.siteTheme` API validates values (`light`/`dark`/`system`), persists explicit choices as a one-year cookie (system clears it), re-applies, and dispatches `themechange`. The rule: explicit visitor choice wins over the system preference — `globals.css`'s `@custom-variant dark` matches both `.dark` and cookie-less system dark (`:root:not(.light)` under `prefers-color-scheme: dark`), so styles must not gate on `.dark` alone.

`ThemeSwitcher.astro` renders the accessible control: a button with `aria-haspopup="menu"`/`aria-expanded`, a `role="menu"` popup of `menuitemradio` options (Light/Dark/System with Phosphor icons), and an sr-only live description of the current choice — the exact behavior `scripts/check-theme.mjs` drives keyboard-only with video recording.

## Component vocabulary

- `Base.astro` — the shared page chrome both apps wrap every route in: site identity from settings, menus, OG/meta emission, and the theme bootstrap.
- `sections/` — composed marketing sections (hero, feature, pricing tiers, testimonials, teams, stats, navbars, footers) that page-builder section components build on.
- `elements/` — primitives (buttons, headings, containers, forms, logos, screenshots).
- `PostCard`, `ProjectCard`, `TaxonomyArchive` — content cards and the taxonomy archive grid used by category/tag routes.
- `icons/` — inline Astro icons; `assets/` — committed logos and screenshots.
- `src/utils/` — `og-image` (shared OG helpers), `page-fragments`, and `seo-graph` (the `buildSiteGraph` JSON-LD assembler the schema endpoints use).

<!-- openwiki: broken internal link [/openwiki/page-builder/block-registry.md] link "/openwiki/page-builder/block-registry.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
The index re-exports `Base`, `PostCard`, and `ProjectCard`; other components are imported by path through the package exports. Page-builder sections in the apps compose these primitives rather than restyling ([Page builder block registry](/openwiki/page-builder/block-registry.md)).
