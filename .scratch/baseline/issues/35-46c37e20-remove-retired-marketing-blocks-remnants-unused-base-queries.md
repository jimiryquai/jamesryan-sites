# 35-46c37e20: Remove retired marketing-blocks remnants, unused Base queries/slots, obsolete scripts and template assets

**Spec:** docs/specs/baseline.md

**What to build:**

Clean up dead code, wasted per-request database queries, dangling schema widget references, obsolete diagnostic scripts, and unreferenced static template files left behind after retiring `marketing-blocks` and migrating seed media:

1. **Dangling `marketing-blocks` widget references in `apps/marketing-site/seed/seed.json`:** Lines `123`, `156`, `236`, and `274` (`testimonials`, `faqs`, `pricing`, and `team` `service` fields) still specify `"widget": "marketing-blocks:service-select"` even though `marketing-blocks` was removed from `apps/marketing-site`. Remove the dangling widget keys from `seed.json`.
2. **Unused `blocks/` components & dead `marketing-blocks` plugin files:** In `apps/marketing-site/src/components/blocks/`, seven files have zero callers (`index.ts`, `Hero.astro`, `Features.astro`, `Testimonials.astro`, `Pricing.astro`, `CTA.astro`, `Document.astro`), while `FAQ.astro:14-19` and `Team.astro:14-19` retain dead `serviceSlug` / `getServiceEntries` fallback branches and `FAQ.astro`, `Team.astro`, `Stats.astro`, `Comparison.astro` belong directly under `src/components/page-builder/` (matching `AGENTS.md:86` / `offered-blocks.mjs`). In `apps/digital-garden`, `src/plugins/marketing-blocks/{index.ts,admin.tsx}` is never registered in `apps/digital-garden/astro.config.mjs`, and `src/styles/theme.css` (retired `#6366f1`/`#f472b6` tokens) is never imported.
3. **Wasted `getMenu` D1 queries, unused imports, and dead slots in `Base.astro`:** `packages/ui/src/components/Base.astro:90-104` executes four unused `getMenu("footer_product" | "footer_company" | "footer_resources" | "footer_legal")` D1 queries on every SSR page request (`footerProduct`..`footerLegal` and `siteLogo` at lines `85-88` are never read), imports seven unused components (`SocialLink`, `NewsletterForm`, `ButtonLink`, `PlainButtonLink`, `XIcon`, `GitHubIcon`, `YouTubeIcon` at lines `24-30`), and `apps/marketing-site/src/layouts/Base.astro:14-18` + `apps/digital-garden/src/layouts/Base.astro:14-18` forward five named slots (`logo`, `actions`, `cta`, `fineprint`, `socialLinks`) that `packages/ui/src/components/Base.astro` does not define. Also remove unused `packages/ui/src/components/TagList.astro` (`packages/ui/src/index.ts:5`).
4. **Obsolete root scripts & broken `"check"` package scripts:** Delete `scripts/check-site.js:1-163` (`=== OATMEAL SAAS MARKETING KIT DIAGNOSTIC SUITE ===` expecting `<title>Oatmeal</title>`, referenced by broken `"check": "node scripts/check-site.js"` in `apps/marketing-site/package.json:16` and `apps/digital-garden/package.json:15`), `scripts/sync-media.js:1-41` (hardcodes `my-marketing-media` and shell-interpolates filenames in `execSync`, superseded by `scripts/seed-local.mjs`), and `scripts/test-manifest.js:1-28` (one-off `devBypass: true` scratch script).
5. **Unreferenced `public/` template and legacy media files:** Remove unreferenced files in `apps/marketing-site/public/` — 19 legacy post images under `public/images/posts/*` (superseded by `apps/marketing-site/seed/assets/*`), `public/hero-visual.svg`, `public/hero-visual-alt.svg`, `public/images/avatar.jpg`, and 16 stock Oatmeal template images under `public/img/{avatars,photos}/*` (zero references in `apps/marketing-site`) — plus unreferenced `apps/digital-garden/public/{hero-visual.svg,hero-visual-alt.svg,images/avatar.jpg}`.

**Blocked by:** none.

**Status:** in progress

- [ ] `apps/marketing-site/seed/seed.json` has zero `"marketing-blocks:*"` references, and `node apps/marketing-site/scripts/sync-page-builder-seed.mjs --check` passes.
- [ ] Dead `apps/marketing-site/src/components/blocks/*` files, unregistered `apps/digital-garden/src/plugins/marketing-blocks/*`, unimported `apps/digital-garden/src/styles/theme.css`, and unused `packages/ui/src/components/TagList.astro` are removed.
- [ ] `packages/ui/src/components/Base.astro` queries only `getMenu("primary")`, drops unused imports/variables, and `apps/*/src/layouts/Base.astro` forwards only slots defined by `Base.astro`.
- [ ] `scripts/{check-site.js,sync-media.js,test-manifest.js}`, broken `"check"` scripts in `apps/*/package.json`, and unreferenced `public/` assets are removed cleanly with `pnpm build` and `bash scripts/check-rendered-seo.sh` passing.

## Comments

**2026-11-12 Gemini (agy Carbon, orchestrator):** Claiming on branch `35-remove-dead-remnants`. Risk: medium (reversible PR to `master`; removes dead code, dangling widget strings, unused D1 menu queries, and unreferenced assets without touching live user-visible copy).
