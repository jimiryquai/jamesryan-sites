---
type: Lesson
title: Declare Cloudflare IMAGES per Wrangler environment, allow 127.0.0.1, and match EmDash constrained preload options
description: Wrangler does not inherit images bindings into env.staging, local Worker checks need 127.0.0.1 in image.domains, and EmDash LCP preloads must validate non-empty string media keys and pass same-origin constrained cover/center options to getImage.
tags: [cloudflare, astro, emdash, images, performance]
generated: { by: agy/gemini-4-carbon, at: 2026-11-16T11:39:00Z }
sources:
  - id: ticket
    resource: .scratch/perf/issues/01-735bab4f-wire-cloudflare-images-binding-and-responsive-r2-media-sizin.md
  - id: resolver
    resource: packages/cms-helpers/src/responsive-images.ts
  - id: config
    resource: packages/astro-config/index.mjs
---

# Context
Before ticket `01-735bab4f`, R2 media on `jamesryan.dev/` shipped full `1536×1024` originals (`~316 KiB` mobile Lighthouse waste) at `/_emdash/api/media/file/*` because neither app declared a Cloudflare `IMAGES` binding, card slots lacked fallback dimensions when media snapshots omitted `width`/`height`, and LCP `<link rel="preload" as="image">` blocks passed root-relative `/_emdash/...` paths to `getImage`, which Astro returned unchanged without `imagesrcset` or `imagesizes`.[^ticket] During implementation and cross-family Spec review, four subtleties emerged: Wrangler's schema does not inherit `"images"` into `env.staging` (and `"remote": true` breaks offline `wrangler dev --local`), local Worker validation binds `http://127.0.0.1:<port>` rather than `localhost`, `<EmDashImage>`'s constrained `<AstroImage>` defaults to `fit: "cover"` and `position: "center"` without forcing `format`, and malformed/empty media snapshots (`{ id: "" }` or non-string `meta.storageKey`) or backslash-authority paths (`"/\\example.com/a.jpg"`) must be rejected before interpolating `/_emdash/api/media/file/<key>` or calling `getImage`.[^resolver][^config]

# Lesson
Declare `"images": { "binding": "IMAGES" }` (without `"remote": true`) in both top-level and every named Wrangler environment (`env.staging`), include `"127.0.0.1"` alongside `"localhost"` in Astro `image.domains`, and route all EmDash LCP `<link rel="preload" as="image">` tags through `@jamesryan/cms-helpers`'s `resolveResponsiveImagePreload` + `IMAGE_SLOTS` so non-empty string media keys, `/^\/[/\\]/` + same-origin guards, and `layout: "constrained", fit: "cover", position: "center"` produce byte-identical `href`, `imagesrcset`, and `imagesizes` to `<EmDashImage>`.[^resolver][^config]

# How to apply
- When adding a new Astro/Cloudflare app or Wrangler environment, assert `config.images.binding === "IMAGES"` and `config.images.remote !== true` via Wrangler's `unstable_readConfig` across all environments in `packages/astro-config/test/config.test.mjs`.
- Pass `...IMAGE_SLOTS.<slot>` (`card`, `featuredPost`, `postHero`, `projectHero`) to EmDash `<Image>` components and `resolveResponsiveImagePreload(getImage, image, { origin: getPublicOrigin(...), ...IMAGE_SLOTS.<slot> })` for LCP preloads, guarding `{preload?.href && (...)}`.
- Mark intentional tiny raw `<img>` elements (such as `20×20` byline avatars) with `data-byline-avatar` so `scripts/check-rendered-media.mjs` verifies their HTTP `200` `image/*` bytes without weakening the `/_image` `srcset`/`sizes` requirement on content media.

[^ticket]: Ticket `01-735bab4f` (`01-responsive-images`, merged in PR #52 `e0e1702`)
[^resolver]: `packages/cms-helpers/src/responsive-images.ts`
[^config]: `packages/astro-config/index.mjs` and `packages/astro-config/test/config.test.mjs`
