# 01-735bab4f: Wire Cloudflare IMAGES binding and responsive R2 media sizing

**Spec:** none.

**What to build:**

Enable runtime responsive image optimization for EmDash R2 media across both Astro apps (`apps/marketing-site` and `apps/digital-garden`) with one shared source of truth for slot dimensions, `sizes`, and LCP `<link rel="preload">` generation:

1. **Cloudflare `IMAGES` binding and local loopback domain authorization:**
   - Declare `"images": { "binding": "IMAGES" }` at both top-level and `env.staging` in `apps/marketing-site/wrangler.jsonc` and `apps/digital-garden/wrangler.jsonc` (Wrangler does not inherit `images` into named environments), and update tracked `apps/marketing-site/worker-configuration.d.ts` via Wrangler types so `IMAGES: ImagesBinding` stays in sync.
   - Add `"127.0.0.1"` alongside `"localhost"` in `packages/astro-config/index.mjs` `image.domains` so local Worker validation (`http://127.0.0.1:<port>` in `scripts/check-rendered-seo.sh`) authorizes same-origin media URLs through `/_image` instead of bypassing optimization.

2. **Single source of truth for responsive image slots and LCP preloads (`@jamesryan/cms-helpers`):**
   - Add a focused module in `packages/cms-helpers` (exported from `@jamesryan/cms-helpers`) that owns:
     - Canonical responsive slot presets (`IMAGE_SLOTS`):
       - `card`: `width: 800`, `height: 500`, `sizes: "(min-width: 1024px) 384px, (min-width: 640px) 50vw, calc(100vw - 3rem)"`
       - `featuredPost`: `width: 1200`, `height: 750`, `sizes: "(min-width: 1024px) 720px, calc(100vw - 3rem)"`
       - `postHero`: `width: 1200`, `height: 750`, `sizes: "(min-width: 1280px) 1200px, calc(100vw - 3rem)"`
       - `projectHero`: `width: 1280`, `height: 720`, `sizes: "(min-width: 1280px) 1200px, calc(100vw - 3rem)"`
     - `resolveResponsiveImagePreload(getImage, image, options)` (pure/injectable `getImage` seam for unit tests without an Astro runtime): resolves root-relative `/_emdash/...` media paths against `origin` only when same-origin (rejecting protocol-relative `//` or cross-origin escapes), calls `getImage` with the exact constrained defaults Astro's `<Image layout="constrained">` uses (`width`, `height`, `sizes`, `layout: "constrained"`, `fit: "cover"`, `position: "center"`, without forcing `format` when `EmDashImage` omits it), and returns `{ href, imagesrcset, imagesizes }` (falling back cleanly to `{ href }` when unoptimizable or external).

3. **Apply slot presets and matching responsive preloads across UI and routes:**
   - Apply `IMAGE_SLOTS.card` (`width`, `height`, `sizes`) to `<Image>` in `packages/ui/src/components/PostCard.astro` and `packages/ui/src/components/ProjectCard.astro` (covering cards when CMS media snapshots omit stored `width`/`height` and capping desktop card `sizes` instead of `100vw`).
   - Apply `IMAGE_SLOTS.featuredPost` (`width`, `height`, `sizes`, plus `priority` where above the fold) in `apps/marketing-site/src/components/page-builder/PostsFeaturedGrid.astro`, `apps/marketing-site/src/pages/posts/index.astro`, and `apps/digital-garden/src/pages/index.astro`.
   - Apply `IMAGE_SLOTS.postHero` (`width`, `height`, `sizes`, `priority`) in `apps/marketing-site/src/pages/posts/[slug].astro` and `apps/digital-garden/src/pages/posts/[slug].astro`, and `IMAGE_SLOTS.projectHero` (`width`, `height`, `sizes`, `priority`) in `apps/marketing-site/src/pages/projects/[slug].astro` and `apps/digital-garden/src/pages/projects/[slug].astro`.
   - Replace the duplicated relative-path `getImage` preload blocks in `apps/marketing-site/src/components/page-builder/featured-post-preload.ts` (+ `apps/marketing-site/src/pages/index.astro`) and `apps/marketing-site/src/pages/posts/[slug].astro` with `resolveResponsiveImagePreload` (`origin: getPublicOrigin(Astro.url, Astro.locals.emdash?.config)` or equivalent same-origin public origin), emitting `<link rel="preload" as="image" href={preload.href} imagesrcset={preload.imagesrcset} imagesizes={preload.imagesizes} fetchpriority="high" slot="links" />` so mobile browsers preload the exact `srcset` candidate without double-downloading `1200w`.

4. **Unit and rendered-Worker verification:**
   - Unit-test `IMAGE_SLOTS` and `resolveResponsiveImagePreload` in `packages/cms-helpers` (same-origin absolutizing, protocol-relative/cross-origin rejection, missing `width`/`height` fallback to slot dimensions, matching `imagesrcset`/`imagesizes` output, and graceful fallback when `getImage` throws or returns the input URL unchanged).
   - Update `scripts/check-rendered-media.mjs` so rendered media verification asserts that EmDash `<Image>` elements for seeded post/project cards and heroes emit `/_image?` `srcset` and `sizes` attributes, that fetching a generated `srcset` candidate URL returns HTTP `200` with `image/*` content and non-empty bytes, and that `<link rel="preload" as="image">` on `/` and `/posts/<slug>` carries `imagesrcset` and `imagesizes` matching the rendered LCP `<img>`.

**Blocked by:** none.

**Status:** done

- [x] Both `apps/marketing-site/wrangler.jsonc` and `apps/digital-garden/wrangler.jsonc` declare `"images": { "binding": "IMAGES" }` at top-level and under `env.staging`, `apps/marketing-site/worker-configuration.d.ts` includes `IMAGES: ImagesBinding`, and `packages/astro-config/index.mjs` authorizes `"127.0.0.1"` in `image.domains`.
- [x] `@jamesryan/cms-helpers` exports `IMAGE_SLOTS` and `resolveResponsiveImagePreload` with unit tests covering same-origin URL resolution, cross-origin/protocol-relative rejection, slot dimension fallbacks when media snapshots omit `width`/`height`, `imagesrcset`/`imagesizes` output, and fallback behavior.
- [x] Card, featured-post, post-hero, and project-hero `<Image>` call sites in `packages/ui`, `apps/marketing-site`, and `apps/digital-garden` use `IMAGE_SLOTS`, and `/` plus `/posts/[slug]` in `apps/marketing-site` emit `<link rel="preload" as="image">` with `imagesrcset` and `imagesizes` via `resolveResponsiveImagePreload` with no duplicated preload `getImage` blocks.
- [x] `bash scripts/check-rendered-seo.sh` (including updated `scripts/check-rendered-media.mjs`) passes end-to-end, verifying `/_image` `srcset`/`sizes` rendering, HTTP `200` `image/*` responses on `srcset` candidates, and matching LCP preload `imagesrcset`/`imagesizes` on `/` and `/posts/<slug>`.

## Comments

**2026-11-14 Gemini (agy, orchestrator):** Claimed for `01-responsive-images`. Risk: high (adds Cloudflare `IMAGES` resource binding in both `apps/marketing-site/wrangler.jsonc` and `apps/digital-garden/wrangler.jsonc`; requires saved cross-family review evidence and James's approval before merge to `master` per `docs/agents/review.md`).

**2026-11-16 Gemini (agy, orchestrator):** Completed and merged to `master` via [PR #52](https://github.com/jimiryquai/jamesryan-sites/pull/52) (builder `h01-codex` on `GPT-6.1-Sol`: commits `b1057dc`, `8325136`; integration commit `f0e7427`; merge commit `e0e1702d37bba3b753c6c37d5515683e1461eb70`, approved and merged by `jimiryquai`). Wired Cloudflare `IMAGES` bindings in production and `env.staging` across both apps, authorized `127.0.0.1` in shared `image.domains`, centralized `IMAGE_SLOTS` and `resolveResponsiveImagePreload` in `@jamesryan/cms-helpers`, wired all 9 card/hero `<Image>` call sites and `/` + `/posts/[slug]` LCP preloads, and updated `scripts/check-rendered-media.mjs` (`254` unit tests passing, `12` rendered routes verified).
