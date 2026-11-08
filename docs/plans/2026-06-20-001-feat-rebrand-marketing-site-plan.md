---
title: Rebrand marketing-site from Oatmeal to James Ryan & deploy to staging
type: feat
status: active
date: 2026-06-20
origin: docs/plans/monorepo-migration.md
---

# Rebrand marketing-site from Oatmeal to James Ryan & deploy to staging

## Overview

The monorepo marketing site (`apps/marketing-site`) currently ships dummy "Oatmeal" SaaS branding, fake content (testimonials, pricing, team members, projects), and placeholder D1/R2 bindings that have never been deployed. Meanwhile, the real jamesryan.dev is served by the legacy `astro-blog` Cloudflare Worker with 6 published Power Platform blog posts.

This plan rebrands the marketing site to "James Ryan — AI-native marketer & engineer", simplifies the page structure to match the current live blog (hero + featured post + recent posts grid), imports the 6 existing blog posts from the old seed, and deploys to Cloudflare staging for verification — all without touching the live site until explicitly approved.

## Proposed Solution

### High-level approach

1. **Config**: Point wrangler at the real Cloudflare resources (staging D1/R2/KV), update Astro `site` URL.
2. **Seed**: Rebrand settings, import real posts, clear dummy content, keep collection schemas dormant.
3. **Pages**: Rewrite the homepage to show hero block + featured post + recent posts grid (reusing the existing `posts/index.astro` pattern). Replace the about page with real content. Leave `/posts` listing and `/posts/[slug]` detail pages unchanged.
4. **Verify locally** with `npx emdash dev`, then deploy to Cloudflare staging.

### What stays, what changes

| Area | Current state | Target state |
|------|--------------|--------------|
| Site title | "Oatmeal" | "James Ryan" |
| Tagline | "Customer support that feels like a conversation." | "AI-native marketer & engineer" |
| `site` URL | `https://oatmeal.dev` | `https://jamesryan.dev` |
| Homepage | SaaS marketing blocks only (hero, features, stats, testimonials, FAQ, pricing, CTA) | Hero block + featured post + recent posts grid |
| About page | CMS-driven "Oatmeal" about content | Hardcoded personal about page (matching current live site) |
| Blog posts | 2 fake Oatmeal posts | 6 real Power Platform posts |
| Collections | pages, posts, services, testimonials, faqs, pricing, team, projects — all with fake data | Same schemas, but only pages + posts have real content. Others empty. |
| Wrangler | Placeholder `my-marketing-site` / no DB IDs | Real staging D1/R2/KV bindings |
| Pricing/Contact pages | Active with dummy content | Left in place but no seeded content (render empty state) |
| Marketing-blocks plugin | Active | Stays active (renders hero) |

## Technical Considerations

### Architecture impacts
- No architectural changes. The monorepo structure, shared `@jamesryan/ui` package, and EmDash plugin system are all preserved.
- The homepage changes from a pure CMS-driven page to a hybrid: hero block from CMS + server-side post queries — matching the pattern already used by `posts/index.astro`.

### Schema changes
- The seed collections are identical to what exists today — no migrations needed beyond what EmDash handles automatically on first boot.
- The old blog's `posts` schema (title, featured_image, content, excerpt) matches the marketing site's `posts` schema exactly.

### Featured images on staging
- **Known limitation**: Old blog posts reference media stored in the production R2 bucket (`jamesryan-media`). These IDs won't resolve on staging R2 (`jamesryan-media-staging`). Posts will render without images on staging — this is expected. When production D1/R2 bindings are used, images will appear.
- For the seed, we use the `$media` syntax with external URLs (Unsplash) so staging gets downloadable images. The actual production images come from the existing R2 bucket.

### Post URL structure
- The old blog uses `/posts/[slug]`. The marketing site currently routes blog posts to `/blog/[slug]` (seen in `posts/index.astro` link hrefs like `/blog/${featuredPost.id}`). This inconsistency needs resolving.
- **Decision**: The actual file-system route is `src/pages/posts/[slug].astro`, but the internal links use `/blog/`. We need to check if there's a redirect or if the page actually lives at `/posts/[slug]`. This will be audited in Unit 1.

### Rollback
- The live `astro-blog` worker is completely untouched. If staging doesn't look right, we iterate on the monorepo without any risk.
- Even after production cutover, the old worker code exists in `/home/james/Repos/astro-blog` and can be redeployed in minutes.

### Security
- No auth changes. EmDash admin auth is unchanged.
- No new API surfaces.

## Acceptance Criteria

- [ ] Running `npx emdash dev` in `apps/marketing-site` starts without errors
- [ ] Homepage shows: hero block with personal branding + featured post card + recent posts grid
- [ ] `/posts` shows all 6 blog posts in chronological order
- [ ] `/posts/[slug]` renders individual post content correctly (Portable Text)
- [ ] `/about` shows personal about page with name, role, social links
- [ ] Header shows "James Ryan" as site title with nav links: Home, Blog, About
- [ ] Site title/tagline in settings match "James Ryan" / "AI-native marketer & engineer"
- [ ] No dummy "Oatmeal" text appears anywhere on rendered pages
- [ ] `wrangler.jsonc` has correct staging D1/R2/KV bindings with database IDs
- [ ] `astro.config.mjs` `site` is set to `https://jamesryan.dev`
- [ ] Staging deploy to Cloudflare succeeds and is accessible on `*.workers.dev` URL

## Implementation Units

### Unit 1: Fix post URL routing (`/blog/` → `/posts/`)
**Goal**: All internal links currently point to `/blog/[slug]` but the Astro page route is at `src/pages/posts/[slug].astro`. This means `/blog/` links would 404 for HTML requests. The old live site uses `/posts/[slug]`, so we should update all internal links from `/blog/` to `/posts/` for consistency with the old site and the actual route.
**Files**:
- `apps/marketing-site/src/pages/posts/index.astro` — change `/blog/${...}` hrefs to `/posts/${...}` (lines 104, 149, 197)
- `apps/marketing-site/src/pages/posts/[slug].astro` — change `/blog/${...}` hrefs to `/posts/${...}` (lines 63, 269)
- `apps/marketing-site/src/pages/[...slug].md.ts` — update markdown route blog prefix mapping and siteTitle fallback (lines 15, 43)
- `apps/marketing-site/src/pages/schema/[collection].json.ts` — update `/blog/` references (lines 62, 68, 85)
- `packages/ui/src/components/PostCard.astro` — check if href handling needs updating

### Unit 2: Update wrangler & Astro config
**Goal**: Point the marketing site at real Cloudflare resources for staging deployment.
**Files**:
- `apps/marketing-site/wrangler.jsonc` — real D1/R2/KV bindings, staging env, worker name
- `apps/marketing-site/astro.config.mjs` — `site` URL, SEO graph title/URL

### Unit 3: Rebrand seed.json
**Goal**: Replace all Oatmeal branding and dummy content with real James Ryan content.
**Files**:
- `apps/marketing-site/seed/seed.json` — settings, bylines, menus, home page hero block, import 6 blog posts from old seed, clear dummy content entries (testimonials, pricing, team, projects, services, faqs)

### Unit 4: Rewrite homepage
**Goal**: Homepage renders hero block + featured post + recent posts grid (like current live site).
**Files**:
- `apps/marketing-site/src/pages/index.astro` — combine CMS hero block with post queries

### Unit 5: Rewrite about page
**Goal**: Personal about page matching current live site content.
**Files**:
- `apps/marketing-site/src/pages/about.astro` — hardcoded about content with social links

### Unit 6: Fix blog listing copy
**Goal**: Remove "Oatmeal" copy from the posts listing page.
**Files**:
- `apps/marketing-site/src/pages/posts/index.astro` — update header text ("Our Blog" → "Blog", "Stories from the team" → appropriate heading, remove Oatmeal fallback tagline)

### Unit 7: Local verification & staging deploy
**Goal**: Verify everything works locally, then deploy to Cloudflare staging.
**Steps**:
1. Run `npx emdash dev` in marketing-site directory
2. Verify all acceptance criteria against localhost:4321
3. Run `pnpm wrangler deploy --env staging` from marketing-site directory
4. Verify staging URL works

## Sources & References

- **Origin document**: [monorepo-migration.md](../../docs/plans/monorepo-migration.md)
- **Old blog seed**: [seed.json](file:///home/james/Repos/astro-blog/seed/seed.json) — 6 posts, taxonomies, settings
- **Old blog wrangler**: [wrangler.jsonc](file:///home/james/Repos/astro-blog/wrangler.jsonc) — real D1/R2/KV IDs
- **Existing posts listing pattern**: [posts/index.astro](../../apps/marketing-site/src/pages/posts/index.astro) — featured post + grid layout (reusable for homepage)
- **Learning: Seed media syntax**: [emdash-seed-image-fields-use-media-syntax.md](file:///home/james/Repos/astro-blog/.learnings/emdash/emdash-seed-image-fields-use-media-syntax.md)
- **Learning: Local dev seeding workflow**: [emdash-seeding-with-cloudflare-d1-r2-local-dev-workflow.md](file:///home/james/Repos/astro-blog/.learnings/emdash/emdash-seeding-with-cloudflare-d1-r2-local-dev-workflow.md)
- **Flexible blocks brainstorm**: [flexible-blocks-brainstorm.md](../../docs/plans/flexible-blocks-brainstorm.md) — future block types for the marketing site
