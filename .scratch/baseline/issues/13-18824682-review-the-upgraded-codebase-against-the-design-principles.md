# 13-18824682: Review the upgraded codebase against the design principles

**Spec:** docs/specs/baseline.md

**What to build:**

Review this repo, `../emdash-plugin-code-block-pro` and `../emdash-plugin-ai-comment-moderation` against `~/Repos/Workspace/building/agent-workflow/docs/design-principles.md` (deep modules, one source of truth, config versus derived defaults, agent-native interfaces), plus correctness, security (auth, tokens, sandbox capabilities) and dead code. Pay particular attention to: duplication between the two apps (`marketing-blocks` is identical in both, and the astro configs mostly duplicate each other), what belongs in `packages/cms-helpers` and `packages/ui`, and leftover garden pages (`home-01..03` etc.). Each finding becomes a ticket in this effort or the backlog; this ticket makes no code changes.

**Blocked by:** 05-10cd2eae, 06-7a434f76, 09-b9733862, 10-eaea4d2b, 17-caadd917.

**Status:** needs James: triage findings (tickets 28-01f74e46..36-aff31a4e and backlog lines 8..10)

- [x] A findings report lives in a comment on this ticket, each finding linked to a new ticket or a backlog line.
- [ ] James has triaged the findings (status `needs James` until then).

## Comments

**2026-11-12 Gemini (agy Carbon, orchestrator):** Unblocked from `11-3b1d7a85` with James's approval ("yeah dude go for it", 2026-11-12; all of 11's code is merged on `master` and only awaits live Workers AI credentials). Claiming for `h13-agy` (`gemini-4-carbon-medium`). Risk: low (read-only architectural review across `jamesryan-sites`, `../emdash-plugin-code-block-pro`, and `../emdash-plugin-ai-comment-moderation`; makes no code changes, findings triaged by James).

**2026-11-12 Gemini (agy Carbon, orchestrator — verified findings from `h13-agy` `8e8a742`, re-checked against `origin/master` `8b60d84`):**

### Codebase Review Findings (`13-18824682`)

Reviewed across all three repositories against `agent-workflow/docs/design-principles.md` (deep modules, one source of truth, configuration vs derived defaults, agent-native interfaces), `CODING_STANDARDS.md`, correctness, security, and dead code:

- `jamesryan-sites` (`ba98963` on `baseline`, cross-checked against `8b60d84` on `origin/master` after PR #36)
- `emdash-plugin-code-block-pro` (`c58ec42` on `master`)
- `emdash-plugin-ai-comment-moderation` (`33762ab` on local `master`; also cross-checked `d3699c7` / `v2.1.0` on `origin/master`)

---

#### 1. Security, Trust Boundaries & Cache Isolation (`jamesryan-sites`)

1. **Tracked `.wrangler/` local state (session blobs, SQLite DB, R2 media) and `.emdash/` generated schemas in git**
   - **Evidence:** `.gitignore:22` ignores `.wrangler/` and `.gitignore:47` ignores `.emdash/`, yet `git ls-files` tracks 215 files under `.wrangler/` — `.wrangler/deploy/config.json`, 45 session KV blobs under `.wrangler/state/v3/kv/SESSION/blobs/*`, a local D1 SQLite database under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` (containing a `dev@emdash.local` user row), and 146 R2 media blobs — plus `.emdash/{schema.json,types.ts}`, `apps/marketing-site/seed/.emdash/{schema.json,types.ts}`, and `apps/digital-garden/seed/.emdash/{schema.json,types.ts}`.
   - **Routed to:** [`.scratch/baseline/issues/28-01f74e46-untrack-wrangler-runtime-state-and-emdash-generated-schemas.md`](28-01f74e46-untrack-wrangler-runtime-state-and-emdash-generated-schemas.md)

2. **Unescaped `<script>` attribute/src/body interpolation and dropped body placements in `Base.astro`**
   - **Evidence:** `packages/ui/src/components/Base.astro:36-46` interpolates `f.attributes` (`${k}="${v}"`), `f.src` (`src="${f.src}"`), and inline `f.code` (`<script ${attrs}>${f.code}</script>`) into `headFragmentsHtml` (`line 374`) without escaping `"`, `&`, `<`, `>`, or closing `</script>` sequences. Lines `351-354` filter `f.placement === "head"` and drop `"body-start"` and `"body-end"` plugin contributions.
   - **Routed to:** [`.scratch/baseline/issues/29-79f19342-harden-html-fragment-escaping-cms-link-protocols-and-untrust.md`](29-79f19342-harden-html-fragment-escaping-cms-link-protocols-and-untrust.md)

3. **Unvalidated CMS URL scheme (`javascript:` XSS vector) on project detail links**
   - **Evidence:** `apps/marketing-site/src/pages/projects/[slug].astro:101` and `apps/digital-garden/src/pages/projects/[slug].astro:101` render `<a href={project.data.url}>` directly from an unvalidated string field without restricting protocols to `http:` or `https:`.
   - **Routed to:** [`.scratch/baseline/issues/29-79f19342-harden-html-fragment-escaping-cms-link-protocols-and-untrust.md`](29-79f19342-harden-html-fragment-escaping-cms-link-protocols-and-untrust.md)

4. **Raw unsanitized HTML sink (`Document.astro`) and unauthenticated PII-logging contact `POST` handler (`digital-garden/contact.astro`)**
   - **Evidence:** `apps/marketing-site/src/components/blocks/Document.astro:22` (unused) and `apps/digital-garden/src/components/blocks/Document.astro:22` (wired via `apps/digital-garden/src/components/MarketingBlocks.astro:14,40`) render `<div set:html={content} />` without sanitization. `apps/digital-garden/src/pages/contact.astro:20-50,83-109` accepts unauthenticated `POST`s without CSRF or rate limiting, logs visitor PII (`name`, `email`, `company`, `message`) via `console.log` (`lines 36-41`) to Worker logs, discards the submission, and displays a 24-hour reply promise alongside `hello@acme.example` (`line 89`).
   - **Routed to:** [`.scratch/baseline/issues/29-79f19342-harden-html-fragment-escaping-cms-link-protocols-and-untrust.md`](29-79f19342-harden-html-fragment-escaping-cms-link-protocols-and-untrust.md)

5. **OpenGraph image unescaped HTML interpolation, draft exposure, and `immutable` public caching**
   - **Evidence:** `apps/marketing-site/src/pages/og/[...slug].png.ts:33,60-79,99` and `og/default.png.ts:17-33,53` (duplicated in `apps/digital-garden/src/pages/og/{[...slug].png.ts,default.png.ts}`) interpolate `${siteTitle}`, `${title}`, `${subtitle}`, and `${url.host}` unescaped into Satori HTML, omit `status === "published"` and `Astro.cache.set(cacheHint)`, return HTTP `200` for missing or draft slugs, and set `"Cache-Control": "public, max-age=31536000, immutable"`.
   - **Routed to:** [`.scratch/baseline/issues/31-3370abcf-fix-opengraph-image-route-prefixes-html-escaping-draft-cachi.md`](31-3370abcf-fix-opengraph-image-route-prefixes-html-escaping-draft-cachi.md)

6. **Missing `status: "published"`, `Astro.cache.set(cacheHint)`, preview cache guards, and SSR CORS headers across feeds, JSON-LD, and Worker routes**
   - **Evidence:**
     - `apps/marketing-site/src/pages/rss.xml.ts:10-13,50-52` and `apps/digital-garden/src/pages/rss.xml.ts:10-13,50-52` query `getEmDashCollection("posts")` without `status: "published"` or `cache.set(cacheHint)` while returning `Cache-Control: public, max-age=3600`.
     - `apps/marketing-site/src/pages/schema/[collection].json.ts:18,133` and `apps/marketing-site/src/pages/schemamap.xml.ts:8-13` (and `digital-garden` copies) query collections without `status: "published"` or `cache.set(cacheHint)`.
     - `apps/marketing-site/src/pages/posts/[slug].astro:84-88`, `apps/marketing-site/src/pages/projects/[slug].astro:23-26`, and `packages/cms-helpers/src/service-content.ts:34` omit `status: "published"` on related-entry and service-scoped queries; `packages/ui/src/components/Base.astro:78,98` omits `cacheHint` propagation.
     - `apps/digital-garden/src/pages/[...slug].md.ts:31,54` serves `Cache-Control: public, max-age=3600` without `entry.data.status === "published"` or `getRequestContext()` preview/edit isolation (unlike `apps/marketing-site/src/utils/content-markdown.ts:59-67`).
     - `apps/marketing-site/public/_headers:1-25` and `apps/digital-garden/public/_headers:1-25` declare `Access-Control-Allow-Origin: *`, `Cache-Control`, and `No-Vary-Search` for SSR routes (`/.well-known/*`, `/schema/*`, `/schemamap.xml`, `/sitemap.xml`, `/*`), which Cloudflare Workers Assets ignores for Worker-rendered responses.
   - **Routed to:** [`.scratch/baseline/issues/32-a552c031-enforce-published-filtering-cache-hints-url-normalization-an.md`](32-a552c031-enforce-published-filtering-cache-hints-url-normalization-an.md) (and garden page route gating remains tracked on [`.scratch/backlog.md:7`](../../backlog.md#L7))

*Verified sound:* The Usermaven proxy (`apps/marketing-site/src/utils/usermaven.ts:1-330`, `src/pages/s1/[...path].ts:1-14`) enforces path-traversal normalization, 64 KiB body bounds, header allowlisting (stripping cookies, `authorization`, and client `x-forwarded-for`), `cache.set(false)`, and 404 gating when `USERMAVEN_KEY` is unset. `scripts/mcp-no-oauth.mjs:1-79` enforces loopback-only origins for `--no-oauth` and HTTPS without embedded credentials for remote token requests.

---

#### 2. Correctness, Accessibility & Verification Seams (`jamesryan-sites`)

7. **Broken `System` dark mode on post and search pages, invalid Tailwind slash-alpha raw CSS, and cookie-forced CI blind spot**
   - **Evidence:** `packages/ui/src/components/theme-init.js:4-9` leaves `<html>` without `.dark` when `preference === "system"` (the default for every visitor without a `theme` cookie). However, `apps/marketing-site/src/pages/posts/[slug].astro:373-551` and `apps/digital-garden/src/pages/posts/[slug].astro:371-549` gate dark styles on `:global(.dark)`, rendering dark `--color-olive-800` / `--color-olive-950 !important` text and comment inputs against `#0c0c09` (`--color-olive-950`) on dark OSes. Lines `409,416,422-423,431-432,437,443,467,470,475,478` also write invalid raw CSS `var(--color-olive-950)/2.5` and `white/5` (making `<hr>` invisible). `apps/marketing-site/src/pages/search.astro:27,61,76` and `apps/digital-garden/src/pages/search.astro:27,61,76,82` omit `class="result-snippet"` on `<p set:html={result.snippet} />`, use `:global(.dark)`, and use low-contrast `placeholder-olive-400` / `border-olive-950/10`. `scripts/accessibility-browser.mjs:5` always injects `Cookie: theme=light|dark`, masking default `System` dark mode in `scripts/check-accessibility.mjs` and `scripts/check-comment-fields.mjs`.
   - **Routed to:** [`.scratch/baseline/issues/30-96529855-fix-system-dark-mode-on-post-and-search-pages-and-cover-syst.md`](30-96529855-fix-system-dark-mode-on-post-and-search-pages-and-cover-syst.md)

8. **OpenGraph URL prefix mismatch (`posts`/`projects` vs `blog`/`work`) and request-time Google Fonts network fetches**
   - **Evidence:** `packages/ui/src/components/Base.astro:111-119` builds `/og/posts/${content.id}.png` and `/og/projects/${content.id}.png`, whereas `apps/marketing-site/src/pages/og/[...slug].png.ts:20-26` and `apps/digital-garden/src/pages/og/[...slug].png.ts:19-25` check `prefix === "blog"` and `prefix === "work"`, causing every post and project OG card to query `"pages"` and fall back to the site title. Lines `54-57` (and `og/default.png.ts:12-15`) fetch Inter weights over the network via `loadGoogleFont` at request time.
   - **Routed to:** [`.scratch/baseline/issues/31-3370abcf-fix-opengraph-image-route-prefixes-html-escaping-draft-cachi.md`](31-3370abcf-fix-opengraph-image-route-prefixes-html-escaping-draft-cachi.md)

9. **Double-slash URLs in `/rss.xml` and broken `/work/` + `/pages/contact` URLs in `/schema/[collection].json`**
   - **Evidence:** `apps/marketing-site/src/pages/rss.xml.ts:7,20,41` (and `digital-garden`) concatenates `${siteUrl}/posts/${post.id}` and `${siteUrl}/rss.xml` without stripping `Astro.site`'s trailing slash (`https://jamesryan.dev//posts/...`). `apps/marketing-site/src/pages/schema/[collection].json.ts:83-93` (and `digital-garden`) re-implements `getContentPath` and emits `/work/${entry.id}` (HTTP 404) and `/pages/contact` instead of `/projects/${entry.id}` and `/contact`.
   - **Routed to:** [`.scratch/baseline/issues/32-a552c031-enforce-published-filtering-cache-hints-url-normalization-an.md`](32-a552c031-enforce-published-filtering-cache-hints-url-normalization-an.md)

10. **Duplicate `<title>` suffix on `/posts`, broken CSS variables on `/404`, and unstyled `prose` / phantom `gallery` on `/projects/[slug]`**
    - **Evidence:** `apps/marketing-site/src/pages/posts/index.astro:79` passes `title={`Blog — ${siteTitle}`}` into `Base.astro:80` (`${title} — ${siteTitle}`), producing `Blog — James Ryan — James Ryan`. `apps/marketing-site/src/pages/404.astro:15-16,21-90` (and `digital-garden`) references deleted `--spacing-*`, `--font-size-*`, `--max-width`, `--radius` variables and `.btn*` classes. `apps/marketing-site/src/pages/projects/[slug].astro:45-47,138,144-159` (and `digital-garden`) uses `prose prose-olive` without `@tailwindcss/typography` installed and reads `project.data.gallery`, which does not exist in `seed.json`.
    - **Routed to:** [`.scratch/baseline/issues/33-2cbc0092-restore-markdown-endpoint-block-parity-and-fix-posts-404-and.md`](33-2cbc0092-restore-markdown-endpoint-block-parity-and-fix-posts-404-and.md)

---

#### 3. Design Principles: Deep Modules, One Source of Truth, Configuration & Agent-Native Interfaces (`jamesryan-sites`)

11. **Agent-native Markdown context parity gap (`code-block-pro`, images, and blockquotes dropped from `.md` routes)**
    - **Evidence:** `apps/marketing-site/src/utils/content-markdown.ts:71-123` (`portableTextToMarkdown`) handles only `block._type === "block"`, dropping all `code-block-pro` / `code` snippets and `image` blocks from `/posts/<slug>.md`, `/projects/<slug>.md`, and `prose` layout sections (worked around in `scripts/check-rendered-markdown.mjs:56-60`) and omitting `> ` on `style === "blockquote"` (`lines 82-86`).
    - **Routed to:** [`.scratch/baseline/issues/33-2cbc0092-restore-markdown-endpoint-block-parity-and-fix-posts-404-and.md`](33-2cbc0092-restore-markdown-endpoint-block-parity-and-fix-posts-404-and.md)

12. **Stale `.agents/skills/emdash-mcp/SKILL.md` contradicts `docs/mcp.md` and `docs/publishing.md`**
    - **Evidence:** `.agents/skills/emdash-mcp/SKILL.md:9,12` names non-existent `emdash-marketing` instead of `emdash-site` (`docs/mcp.md:5`) and forbids `mcporter` shell calls even though site MCP servers are reached via `mcporter` since ticket `22-032faafb`. Lines `3,23,25,29-31,38,41` instruct agents to `publish, or delete` content (violating the draft-only agent / human-publishes workflow in `docs/publishing.md`) and use retired `pages.content`, `/blog`, and `post_tag` examples.
    - **Routed to:** [`.scratch/baseline/issues/36-aff31a4e-align-emdash-mcp-skill-with-mcporter-config-and-human-publis.md`](36-aff31a4e-align-emdash-mcp-skill-with-mcporter-config-and-human-publis.md)

13. **Template-era `README.md` and `AGENTS.md` contradict monorepo paths, Olive design system, and schema**
    - **Evidence:** `README.md:1-84` still describes `# EmDash Marketing Template (Cloudflare)`, and `AGENTS.md:6-22,56-61,78-82,94-137` instructs agents to edit single-app root paths (`src/styles/theme.css`, `#6366f1`/`#f472b6`) and claims `No taxonomies` despite `category` and `tag` in `apps/marketing-site/seed/seed.json`.
    - **Routed to:** Existing baseline ticket [`.scratch/baseline/issues/14-8bdab846-rewrite-the-readme-and-close-the-baseline.md`](14-8bdab846-rewrite-the-readme-and-close-the-baseline.md) (`ready-for-agent`; not duplicated)

14. **Duplicated JSON-LD `Person` entity with drifted LinkedIn URLs and duplicated page-URL mappers in scripts**
    - **Evidence:** `Person` JSON-LD is hardcoded in `packages/ui/src/components/Base.astro:203-231` (`linkedin.com/in/jimiryquai/`) and duplicated in `apps/marketing-site/src/pages/schema/[collection].json.ts:32-60` and `apps/digital-garden/src/pages/schema/[collection].json.ts:32-60` (`linkedin.com/in/jamesryan.dev/`). `scripts/check-rendered-markdown.mjs:21-26` and `scripts/check-rendered-media.mjs:23` re-implement `getContentPath` instead of importing `@jamesryan/cms-helpers`.
    - **Routed to:** [`.scratch/baseline/issues/32-a552c031-enforce-published-filtering-cache-hints-url-normalization-an.md`](32-a552c031-enforce-published-filtering-cache-hints-url-normalization-an.md) and [`.scratch/baseline/issues/33-2cbc0092-restore-markdown-endpoint-block-parity-and-fix-posts-404-and.md`](33-2cbc0092-restore-markdown-endpoint-block-parity-and-fix-posts-404-and.md)

15. **Scattered `"Oatmeal"` / `"My Blog"` identity fallbacks, ~110-line duplicated `astro.config.mjs`, duplicated discovery/taxonomy routes, and package script/telemetry drift**
    - **Evidence:**
      - Site identity fallbacks span `apps/marketing-site/src/utils/site-identity.ts:1-21` and `apps/digital-garden/src/utils/site-identity.ts:1-21` (`"My Blog"`), `packages/ui/src/components/Base.astro:79,82,107` (`"Oatmeal"`, `"https://oatmeal.dev"`), `apps/marketing-site/src/pages/projects/index.astro:49` and `apps/digital-garden/src/pages/projects/index.astro:43` (`"from the Oatmeal team"`), and `apps/*/src/pages/og/*.ts`.
      - `apps/marketing-site/astro.config.mjs:1-130` and `apps/digital-garden/astro.config.mjs:1-125` duplicate ~110 lines verbatim (`vite.optimizeDeps`, `seoGraph`, 21-icon `ph` allowlist, EmDash Cloudflare D1/R2/sandbox/MCP + SEO `0.12` workaround, Inter font weights, image domains).
      - `src/worker.ts`, `src/layouts/Base.astro`, `src/pages/{robots.txt.ts,rss.xml.ts,schemamap.xml.ts,.well-known/api-catalog.ts}`, and `category/[slug].astro` vs `tag/[slug].astro` are duplicated across/within both apps.
      - `apps/digital-garden/package.json:11-14` omits `ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false` (present in `apps/marketing-site/package.json:11-14`), retains unused `kysely` (`line 42`) and `ulidx` (`line 45`) devDependencies, and neither `packages/cms-helpers/package.json` nor `packages/ui/package.json` defines `typecheck`.
    - **Routed to:** [`.scratch/baseline/issues/34-688a3b6c-consolidate-duplicated-site-identity-astro-config-discovery.md`](34-688a3b6c-consolidate-duplicated-site-identity-astro-config-discovery.md)

---

#### 4. Dead Code, Wasted Per-Request Queries & Template Leftovers (`jamesryan-sites`)

16. **Dangling `"marketing-blocks:service-select"` schema widgets, dead `blocks/` components, 4 wasted `getMenu` D1 queries per request, obsolete root scripts, and unreferenced `public/` template assets**
    - **Evidence:**
      - `apps/marketing-site/seed/seed.json:123,156,236,274` still sets `"widget": "marketing-blocks:service-select"` after `marketing-blocks` was retired.
      - `apps/marketing-site/src/components/blocks/{index.ts,Hero.astro,Features.astro,Testimonials.astro,Pricing.astro,CTA.astro,Document.astro}` have zero callers; `FAQ.astro:14-19` and `Team.astro:14-19` retain dead `serviceSlug` / `getServiceEntries` branches; `apps/digital-garden/src/plugins/marketing-blocks/{index.ts,admin.tsx}` is unregistered in `astro.config.mjs`; `apps/digital-garden/src/styles/theme.css` is unimported; `packages/ui/src/components/TagList.astro` (`packages/ui/src/index.ts:5`) has zero callers.
      - `packages/ui/src/components/Base.astro:24-30,85-104` has 7 unused imports, computes unused `siteLogo`, and runs 4 unused `getMenu("footer_*")` D1 queries on every SSR request; `apps/*/src/layouts/Base.astro:14-18` forwards 5 non-existent slots (`logo`, `actions`, `cta`, `fineprint`, `socialLinks`).
      - `scripts/check-site.js:1-163` (`=== OATMEAL SAAS MARKETING KIT DIAGNOSTIC SUITE ===` referenced by broken `"check": "node scripts/check-site.js"` in `apps/marketing-site/package.json:16` and `apps/digital-garden/package.json:15`), `scripts/sync-media.js:1-41` (`my-marketing-media` + shell-interpolated `execSync`), and `scripts/test-manifest.js:1-28` (`devBypass: true` scratch script) are obsolete.
      - `apps/marketing-site/public/` retains 19 unreferenced post images in `public/images/posts/*` (superseded by `seed/assets/*`), `public/hero-visual*.svg`, `public/images/avatar.jpg`, and 16 stock Oatmeal images in `public/img/{avatars,photos}/*` (plus `apps/digital-garden/public/{hero-visual*.svg,images/avatar.jpg}`).
    - **Routed to:** [`.scratch/baseline/issues/35-46c37e20-remove-retired-marketing-blocks-remnants-unused-base-queries.md`](35-46c37e20-remove-retired-marketing-blocks-remnants-unused-base-queries.md)

17. **Digital garden Oatmeal demo pages (`home-01..03`, `about-01..03`, `pricing-01..03`, `privacy-policy-01..02`, `404-01..02`) and `MarketingBlocks` content model**
    - **Evidence:** `apps/digital-garden/src/pages/` still serves 13 Oatmeal demo routes (`home-01..03.astro`, `about-01..03.astro`, `pricing-01..03.astro`, `privacy-policy-01..02.astro`, `404-01..02.astro`), `apps/digital-garden/src/components/MarketingBlocks.astro:1-45`, `apps/digital-garden/src/components/blocks/*`, and `/img/*` stock seed references (`apps/digital-garden/seed/seed.json`). Per `docs/specs/baseline.md`, the garden's content model is parked for a later project.
    - **Routed to:** [`.scratch/backlog.md:8`](../../backlog.md#L8)

---

#### 5. External Plugin Repositories

18. **`emdash-plugin-code-block-pro` (`/home/james/Repos/Workspace/building/emdash-plugin-code-block-pro` @ `c58ec42`)**
    - **Evidence:**
      - **Worker CPU/OOM DoS:** `src/utils/parseLineHighlights.ts:14-15` expands `start-end` into a `Set` (`for (let i = start; i <= end; i++) result.add(i)`) with no upper bound or positive-line clamp (e.g. `"1-99999999"` exhausts Worker CPU/memory).
      - **Inline CSS injection:** `src/astro/CodeBlockPro.astro:207` injects free-form `maxHeight` (`src/index.ts:26`) into `style={maxHeight ? \`max-height:${maxHeight}\` : undefined}` without CSS length validation.
      - **Copy-button double entity decoding & `lineNumbers` string check:** `src/astro/CodeBlockPro.astro:501-508` runs `.replace(/&amp;/g, "&").replace(/&lt;/g, "<")...` on `btn.getAttribute("data-code")`, which the browser DOM already decoded, corrupting code snippets that contain HTML entities (`&amp;`, `&lt;`), and `navigator.clipboard.writeText(...)` (`line 510`) lacks `.catch(...)`. Line `93` checks `if (lineNumbers && startNumber !== 1)` (truthy for `"false"`), unlike line `106` (`lineNumbers === true || lineNumbers === "true"`).
      - **Unscoped `<pre>` color regexes & Shiki cold-start/cache/duplication:** `src/astro/CodeBlockPro.astro:62-69` matches `background-color:` and `(?<!-)color:` across the entire `highlightedHtml` string instead of `<pre>`'s `style` attribute. `src/utils/highlighter.ts:45-54` caches a rejected `highlighterPromise` permanently if initialization fails once and eagerly loads all 14 languages (`langs: [...LANGUAGE_VALUES]`) on cold start, making on-demand `loadLanguage` (`lines 66-77`) dead for built-in languages; `THEME_MAP` (`lines 10-35`) duplicates all 24 keys from `src/constants.ts:23-48` while `THEME_VALUES` (`src/constants.ts:60`) is unused in production.
      - **Repo, packaging & CI hygiene:** `.gitignore:1` lists only `node_modules`, leaving `.astro/*` (including `.woff2` fonts), `sandbox.db`, and `emdash-env.d.ts` tracked in git alongside both `package-lock.json` and `pnpm-lock.yaml`; `package.json:18,20,51-56` ships internal `"docs"` (`docs/plans/*`, `docs/sandbox-plan.md`) in the npm tarball and declares unused `react` / `@types/react` peerDependencies for type-only `src/admin.tsx:1-11`; `.github/workflows/publish.yml:15-23` publishes without running typecheck, lint, or tests, and `.github/workflows/{ci,test,lint,security}.yml` run four separate `npm ci --legacy-peer-deps` jobs on Node 22 (`mcporter` `0.17.0` requires Node 24+).
    - **Routed to:** [`.scratch/backlog.md:9`](../../backlog.md#L9)

19. **`emdash-plugin-ai-comment-moderation` (`/home/james/Repos/Workspace/building/emdash-plugin-ai-comment-moderation` @ `33762ab`, `origin/master` @ `d3699c7` / `v2.1.0`)**
    - **Evidence:**
      - **Stale local checkout:** Local `master` (`33762ab`, `2.0.0`) is 2 commits behind `origin/master` (`d3699c7`, `v2.1.0`, which added `admin.settingsSchema` with encrypted `apiToken: { type: "secret" }` in commit `42f191d` and is already consumed by `apps/marketing-site/package.json:35`).
      - **Unvalidated URL path interpolation to `api.cloudflare.com`:** `src/plugin.ts:90` interpolates `accountId` and `model` directly into `` `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}` `` without `encodeURIComponent` or format/traversal checks (`..`, `?`, `#`), allowing path traversal across `allowedHosts: ["api.cloudflare.com"]` (`emdash-plugin.jsonc:12`) with `Authorization: Bearer ${apiToken}`.
      - **Prompt-injection & first-brace JSON parser fragility:** `src/plugin.ts:98-109` sends untrusted visitor comments without `response_format` (`json_schema`), `max_tokens` bounds (allowing token-exhaustion timeouts into `fallbackModeration`), or untrusted-input delimiter framing; `src/plugin.ts:162,169` moderates only `comment.body` (ignoring spam/abuse in `comment.authorName`); and `parseModerationResponse` (`src/plugin.ts:30-41`) matches the first `{[\s\S]*?}` in model output, which an echoed `{"spam":false,"toxic":false}` inside a comment can satisfy.
      - **Dead metadata mutations, duplicated `DEFAULT_MODEL` & mock-only duplicate test suite:** `src/plugin.ts:165,170-173` mutates `event.metadata.ai_moderation`, which EmDash 1.4's isolated sandbox transport discards (`README.md:78-80`); `v2.1.0` duplicates `DEFAULT_MODEL` across `src/plugin.ts:8`, `plugin:install` (`lines 149-155`), and `emdash-plugin.jsonc` `settingsSchema.model.default`; `tests/moderation.test.ts:16-73` maintains hand-rolled `FakeKV`/`FakeHttp` mocks duplicating the real `workerd` integration suite in `tests/sandbox.test.ts`; and `package.json:12-16` omits `"LICENSE"` from `"files"` despite `README.md:122` linking `./LICENSE`.
    - **Routed to:** [`.scratch/backlog.md:10`](../../backlog.md#L10)
