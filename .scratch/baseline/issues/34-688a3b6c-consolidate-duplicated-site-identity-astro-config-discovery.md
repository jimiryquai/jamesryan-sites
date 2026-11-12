# 34-688a3b6c: Consolidate duplicated site identity, Astro config, discovery endpoints and taxonomy routes

**Spec:** docs/specs/baseline.md

**What to build:**

Eliminate shallow pass-throughs and multi-file duplication across `apps/marketing-site`, `apps/digital-garden`, and `packages/`:

1. **Single source of truth for site identity fallbacks:** Site title/tagline/URL fallbacks are currently scattered and contradictory across eight files: `apps/marketing-site/src/utils/site-identity.ts:1-21` and `apps/digital-garden/src/utils/site-identity.ts:1-21` (`"My Blog"`), `packages/ui/src/components/Base.astro:79,82,107` (`"Oatmeal"`, `"Customer support that feels like a conversation."`, `"https://oatmeal.dev"`), `apps/marketing-site/src/pages/projects/index.astro:49` and `apps/digital-garden/src/pages/projects/index.astro:43` (`"from the Oatmeal team"`), and `apps/*/src/pages/og/*.ts` (`"Oatmeal"` / `"Oatmeal Digital Garden"`). Centralize site identity resolution in `@jamesryan/cms-helpers` with per-app defaults derived from config rather than `"Oatmeal"` / `"My Blog"` template strings.
2. **Shared Astro + EmDash configuration builder:** `apps/marketing-site/astro.config.mjs:1-130` and `apps/digital-garden/astro.config.mjs:1-125` duplicate ~110 lines verbatim (`vite.optimizeDeps`, `seoGraph`, the 21-icon `ph` allowlist, EmDash Cloudflare D1/R2/sandbox/MCP wiring, the `@emdash-cms/plugin-seo` `0.12` `adminEntry` workaround, Inter font weights, and image domains), differing only in `site`, dev `port`, `extraPlugins` (`pageBuilder` + `aiCommentModeration`), and `redirectPolicy`. Extract a deep shared config factory so site-specific files pass only their differences.
3. **Shared worker entrypoint, discovery endpoints & taxonomy archive component:** Deduplicate identical or near-identical files across both apps (`src/worker.ts:1-5`, `src/layouts/Base.astro:1-21`, `src/pages/robots.txt.ts:1-16`, `src/pages/rss.xml.ts:1-70`, `src/pages/schemamap.xml.ts:1-35`, `src/pages/.well-known/api-catalog.ts:1-18`) and collapse the 95%-identical `category/[slug].astro` and `tag/[slug].astro` archive templates within both apps (`apps/marketing-site/src/pages/{category,tag}/[slug].astro`, `apps/digital-garden/src/pages/{category,tag}/[slug].astro`) into one parameterized taxonomy archive component.
4. **Workspace script & telemetry parity:** Align `apps/digital-garden/package.json:11-14` with `apps/marketing-site/package.json:11-14` so `dev`, `build`, and `typecheck` set `ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false`; remove unused `kysely` and `ulidx` devDependencies from `apps/digital-garden/package.json:42,45`; and add `typecheck` scripts to `packages/cms-helpers/package.json` and `packages/ui/package.json` so `pnpm -r run typecheck` checks shared packages directly.

**Blocked by:** none.

**Status:** done

- [x] Zero `"Oatmeal"`, `"oatmeal.dev"`, or `"My Blog"` fallback strings remain anywhere in `apps/` or `packages/`.
- [x] `apps/marketing-site/astro.config.mjs` and `apps/digital-garden/astro.config.mjs` delegate shared Vite, Astro font/image, SEO graph, icon, and EmDash wiring to one shared module, specifying only per-site options (`site`, `port`, site-specific plugins, `redirectPolicy`).
- [x] Category and tag archive routes render through one shared taxonomy archive component/helper, and shared discovery handlers (`robots.txt`, `rss.xml`, `schemamap.xml`, `api-catalog`) live in one shared package module.
- [x] `apps/digital-garden` disables Astro/Wrangler telemetry in package scripts, drops unused `kysely`/`ulidx` devDependencies, and `pnpm typecheck` typechecks `packages/cms-helpers` and `packages/ui` alongside both apps.

## Comments

**2026-11-12 Gemini (agy Carbon, orchestrator):** Claiming for `34-consolidate-config-routes`. Risk: medium (reversible internal consolidation of site identity fallbacks, Astro config factory, discovery route handlers, taxonomy archive template, and workspace package scripts targeting `master`, reaching staging only until manual production promotion).

**2026-11-12 Gemini (agy Carbon, orchestrator):** Done. Built by `h34-codex` (`GPT-6.1-Sol`) in `defd432` + `5d49645` with 1 cross-family review fix round (`1e7f91b`), merged to `master` via PR #46 (`26864a9`). Removed all `"Oatmeal"`, `"oatmeal.dev"`, and `"My Blog"` fallback strings across `apps/` and `packages/` plus 13 dead `digital-garden` showcase routes (`-5,110 / +991` lines) while preserving live CMS entry content; centralized `resolveSiteIdentity`, discovery handlers (`robots`, `rss`, `schemaMap`, `apiCatalog`), `getTaxonomyArchive` (with `runPublishedOnly` + `emdash:taxonomy:*` cache hints), `TaxonomyArchive.astro` (WCAG 2.1 AA contrast), and `packages/astro-config` (`createSiteConfig` + `worker.ts` + `tsc --noEmit`). Verified independently (`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `bash scripts/check-rendered-seo.sh`). Lesson compounded in `docs/lessons/astro-shared-config-and-taxonomy-route-caching.md`; explainer written at `.scratch/explainers/34-688a3b6c.html`; evidence archived at `.orchestrate/runs/2026-11-12-34-consolidate-config-routes/`.
