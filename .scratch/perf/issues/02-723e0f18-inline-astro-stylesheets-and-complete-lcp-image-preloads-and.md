# 02-723e0f18: Inline Astro stylesheets and complete LCP image preloads and priority

**Spec:** none.

**What to build:**

Eliminate the remaining external `/_astro/*.css` render-blocking stylesheet round-trips and complete LCP image preload & priority coverage across `/posts`, `/projects/[slug]`, `digital-garden`, and `/about` through shared deep-module seams:

1. **Inline Astro stylesheets across both apps (`@jamesryan/astro-config`):**
   - Set `build: { inlineStylesheets: "always" }` in `packages/astro-config/index.mjs` (`createSiteConfig`) so SSR HTML responses inline route CSS instead of emitting render-blocking `<link rel="stylesheet" href="/_astro/*.css">` hops (`render-blocking-insight` and `network-dependency-tree-insight`).
   - Assert `config.build` (`{ inlineStylesheets: "always" }`) in `packages/astro-config/test/config.test.mjs` for both `createSiteConfig` and both apps' exported configs.

2. **Single `<Base preloadImage>` source of truth and full hero preload coverage:**
   - Add an optional `preloadImage?: ResponsiveImagePreload` prop to `packages/ui/src/components/Base.astro` (and forward/preserve full `ComponentProps<typeof SharedBase>` typing in `apps/marketing-site/src/layouts/Base.astro` and `apps/digital-garden/src/layouts/Base.astro`), emitting `<link rel="preload" as="image" href={preloadImage.href} imagesrcset={preloadImage.imagesrcset} imagesizes={preloadImage.imagesizes} fetchpriority="high" />` inside `<head>` whenever `preloadImage?.href` is non-empty.
   - Replace the inline `<link rel="preload" ... slot="links" />` blocks in `apps/marketing-site/src/pages/index.astro` and `apps/marketing-site/src/pages/posts/[slug].astro` with `preloadImage={preload}` on `<Base>`, and wire `preloadImage` via `resolveResponsiveImagePreload` + `getPublicOrigin` + `IMAGE_SLOTS` on:
     - `apps/marketing-site/src/pages/posts/index.astro` (`featuredPost?.data.featured_image` with `IMAGE_SLOTS.featuredPost`)
     - `apps/marketing-site/src/pages/projects/[slug].astro` (`project.data.featured_image` with `IMAGE_SLOTS.projectHero`)
     - `apps/digital-garden/src/pages/index.astro` (`featuredPost?.data.featured_image` with `IMAGE_SLOTS.featuredPost`)
     - `apps/digital-garden/src/pages/posts/[slug].astro` (`post.data.featured_image` with `IMAGE_SLOTS.postHero`)
     - `apps/digital-garden/src/pages/projects/[slug].astro` (`project.data.featured_image` with `IMAGE_SLOTS.projectHero`)
   - Update `apps/marketing-site/test/featured-post-preload.test.mjs` to assert that `packages/ui/src/components/Base.astro` owns the single `<link rel="preload" as="image"` template and that all 7 hero routes pass `preloadImage` to `<Base>` without page-level `<link rel="preload"` duplication.

3. **LCP discovery & intrinsic dimensions on `/about` (`apps/marketing-site/src/pages/about.astro`):**
   - Add `width="500" height="500" fetchpriority="high" decoding="async"` to the fallback `<img src="/images/avatar.webp" alt="James Ryan" ... />` (`avatar.webp` is `500×500`) so Lighthouse `lcp-discovery-insight` passes cleanly with zero layout shift.

4. **Rendered Worker verification (`scripts/check-rendered-media.mjs` + `scripts/check-rendered-media.test.mjs`):**
   - Reject any rendered route that emits an external `<link rel="stylesheet">` pointing under `/_astro/`.
   - Require matching LCP `<link rel="preload" as="image">` (`href`, `imagesrcset`, `imagesizes`) on `/posts` (when `paths.has("/posts")` and a published post has `featured_image`) and `/projects/<slug>` in addition to `/` and `/posts/<slug>`.
   - Assert that `/images/avatar.webp` on `/about` (when present) carries `fetchpriority="high"`, `width="500"`, and `height="500"`.
   - Add unit tests in `scripts/check-rendered-media.test.mjs` covering external `/_astro/*.css` rejection, `/posts` + `/projects/<slug>` preload verification, and `/about` avatar `fetchpriority="high"` + dimensions verification.

**Blocked by:** none.

**Status:** done

- [x] `packages/astro-config/index.mjs` sets `build: { inlineStylesheets: "always" }`, verified by `packages/astro-config/test/config.test.mjs` across `createSiteConfig` and both apps.
- [x] `packages/ui/src/components/Base.astro` owns `<link rel="preload" as="image">` via `preloadImage?: ResponsiveImagePreload`, and all 7 hero routes across `apps/marketing-site` (`/`, `/posts`, `/posts/[slug]`, `/projects/[slug]`) and `apps/digital-garden` (`/`, `/posts/[slug]`, `/projects/[slug]`) pass `preloadImage` with no page-level `<link rel="preload"` duplication.
- [x] `apps/marketing-site/src/pages/about.astro` sets `width="500" height="500" fetchpriority="high" decoding="async"` on `/images/avatar.webp`.
- [x] `bash scripts/check-rendered-seo.sh` and `scripts/check-rendered-media.test.mjs` pass end-to-end, asserting zero external `/_astro/*.css` stylesheets, matching LCP preloads across `/`, `/posts`, `/posts/[slug]`, and `/projects/<slug>`, and `/about` avatar `fetchpriority="high"` + `500×500` dimensions.

## Comments

**2026-11-16 Gemini (agy, orchestrator):** Claimed for `02-inline-css-lcp`. Risk: medium (reversible shared config, UI layout, route, and rendered-check changes across `packages/`, `apps/`, and `scripts/`; merges autonomously to `master` → `staging.jamesryan.dev` after CI, `code-review`, and cross-family review per `docs/agents/review.md`).

**2026-11-16 Gemini (agy, orchestrator):** Completed and merged to `master` via [PR #53](https://github.com/jimiryquai/jamesryan-sites/pull/53) (builder `h02-grok` on `Grok 4.7`: commits `0e68437`, `a10b8b5`, `f47d7a4`; merge commit `b397275c04461d0c8f9851787117069a1cfd2bc7`). Set `build: { inlineStylesheets: "always" }` in `@jamesryan/astro-config`, centralized `<link rel="preload" as="image">` in `@jamesryan/ui` `Base.astro` across all 7 hero routes, added `500×500` + `fetchpriority="high"` + `decoding="async"` on `/about`'s avatar, and updated `scripts/check-rendered-media.mjs` + `scripts/seo-fixture.mjs` (`261` unit tests passing, `12` rendered routes verified).
