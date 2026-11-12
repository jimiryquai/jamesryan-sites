# 32-a552c031: Enforce published filtering, cache hints, URL normalization and SSR response headers

**Spec:** docs/specs/baseline.md

**What to build:**

Audit of non-HTML discovery feeds, JSON-LD endpoints, SSR response headers, and secondary collection queries found several places that violate `docs/published-routes.md` or `AGENTS.md` (`status: "published"`, `Astro.cache.set(cacheHint)`, single URL mapping, preview cache isolation):

1. **RSS double-slash URLs, unfiltered query & missing `cacheHint`:** `apps/marketing-site/src/pages/rss.xml.ts:7,10-13,20,40-41,50-52` (and `apps/digital-garden/src/pages/rss.xml.ts:7,10-13,20,40-41,50-52`) leaves the trailing slash on `site.toString()`, emitting `https://jamesryan.dev//posts/<slug>` (`line 20`) and `https://jamesryan.dev//rss.xml` (`line 41`), omits `status: "published"` and `cache.set(cacheHint)`, and serves `Cache-Control: public, max-age=3600` even if an admin session is active.
2. **Schema JSON-LD broken URLs, drifted `Person` graph & unfiltered entries:** `apps/marketing-site/src/pages/schema/[collection].json.ts:18,32-60,83-93,130-135` (and `apps/digital-garden/src/pages/schema/[collection].json.ts`) queries `getEmDashCollection` without `status: "published"` or `cache.set(cacheHint)`, re-implements `getContentPath` at lines `83-93` (emitting `/work/${entry.id}` 404 URLs instead of `/projects/${entry.id}` and `/pages/contact` instead of `/contact`), and duplicates the `Person` entity (`lines 32-60`) with `https://www.linkedin.com/in/jamesryan.dev/` whereas `packages/ui/src/components/Base.astro:203-231` has `https://www.linkedin.com/in/jimiryquai/`.
3. **Schemamap unfiltered queries & empty-collection links:** `apps/marketing-site/src/pages/schemamap.xml.ts:8-13,27-31` (and `digital-garden`) queries collections without `status: "published"`, `orderBy`, or `cache.set(cacheHint)`, and lists `/schema/projects.json` and `/schema/posts.json` even when a collection has zero published entries.
4. **Missing `status: "published"` / `cacheHint` on secondary queries:** `apps/marketing-site/src/pages/posts/[slug].astro:84-88` (related posts), `apps/marketing-site/src/pages/projects/[slug].astro:23-26` (other work), `packages/cms-helpers/src/service-content.ts:34` (`getCollectionEntriesForService`), and `packages/ui/src/components/Base.astro:78,98` (settings/menu `cacheHint` propagation).
5. **Ineffective `public/_headers` rules on SSR routes:** `apps/marketing-site/public/_headers:1-25` and `apps/digital-garden/public/_headers:1-25` configure `Access-Control-Allow-Origin: *`, `Cache-Control`, and `No-Vary-Search` for `/.well-known/*`, `/schema/*`, `/schemamap.xml`, `/sitemap.xml`, and `/*`. In Cloudflare Workers Assets, `_headers` applies only to static asset responses, not SSR Worker routes, so `/schema/*.json` and `/sitemap.xml` never emit `Access-Control-Allow-Origin: *`. Move SSR response headers into shared route helpers and keep `_headers` scoped to static assets (`/_astro/*`).
6. **Garden `.md` preview/draft cache safety & prefix mapping:** `apps/digital-garden/src/pages/[...slug].md.ts:18-36,52-55` checks `blog`/`work` instead of `posts`/`projects` and sets `Cache-Control: public, max-age=3600` without `entry.data.status === "published"` or `getRequestContext()` session/preview checks (unlike `apps/marketing-site/src/utils/content-markdown.ts:59-67`).

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] `/rss.xml` emits normalized single-slash URLs, filters `status: "published"`, sets `cache.set(cacheHint)`, and never publicly caches draft/session responses.
- [ ] `/schema/[collection].json` and `Base.astro` share one canonical `Person`/`Blog`/`WebSite` graph builder and use `getContentPath` from `@jamesryan/cms-helpers` (zero `/work/` or `/pages/contact` URLs), returning `404` or omitting collections with no published entries consistently with `/schemamap.xml`.
- [ ] Related posts (`posts/[slug].astro`), related projects (`projects/[slug].astro`), and `getCollectionEntriesForService` (`service-content.ts`) filter `status: "published"` and propagate `cacheHint`.
- [ ] Discovery/schema SSR routes emit `Access-Control-Allow-Origin: *` directly from Worker responses (verified by `scripts/check-rendered-seo.sh`), and `public/_headers` documents/targets only static assets.

## Comments
