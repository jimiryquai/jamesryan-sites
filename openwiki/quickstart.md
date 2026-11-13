---
type: orientation
title: Quickstart
description: Orientation for the jamesryan-sites monorepo — what lives where, how to run and check it locally, and which wiki page owns each task.
tags: [orientation, quickstart, monorepo, task-routing]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-fdc3598f8adeb795fc2861ab
    resource: repo://packages/astro-config/index.mjs
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

<!-- openwiki: broken internal link [/openwiki/architecture/monorepo-layout.md] link "/openwiki/architecture/monorepo-layout.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
James Ryan's sites: a pnpm monorepo building two Astro 7 apps on EmDash 1.5 and Cloudflare Workers — `apps/marketing-site` (jamesryan.dev, staging.jamesryan.dev) and `apps/digital-garden` (jamesryan.me, staging only). Three shared packages under `packages/` carry the platform: `@jamesryan/astro-config` (the `createSiteConfig` factory and worker entrypoint), `@jamesryan/cms-helpers` (published-route gating, URL mapping, discovery endpoints, OG images), and `@jamesryan/ui` (olive palette, WCAG 2.2 AA, Astro primitives). Full layout in [Monorepo layout](/openwiki/architecture/monorepo-layout.md).

## Everyday commands

```bash
export ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false   # always
pnpm install
pnpm dev          # marketing-site on :4321
pnpm dev:garden   # digital-garden on :4322
pnpm typecheck && pnpm build && pnpm test
pnpm seed:local   # apply the marketing seed to real local D1/R2 (build first)
```

<!-- openwiki: broken internal link [/openwiki/content/local-seeding.md] link "/openwiki/content/local-seeding.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Fresh local database order: `pnpm build` → `pnpm seed:local` → `pnpm dev`, only then open the admin (or its dev-bypass) — see [Local seeding workflows](/openwiki/content/local-seeding.md).

## Task routing

<!-- openwiki: broken internal link [/openwiki/routing/published-route-boundary.md] link "/openwiki/routing/published-route-boundary.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/content/live-content-collections.md] link "/openwiki/content/live-content-collections.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/routing/discovery-endpoints.md] link "/openwiki/routing/discovery-endpoints.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **Build a site feature** (routes, content queries, Portable Text, taxonomies, widgets, SEO, comments, bylines) — start at [Published-route boundary](/openwiki/routing/published-route-boundary.md) and [Live content collections](/openwiki/content/live-content-collections.md); discovery endpoints and `/og/*` have their own pages under [Routing](/openwiki/routing/discovery-endpoints.md).
<!-- openwiki: broken internal link [/openwiki/page-builder/block-registry.md] link "/openwiki/page-builder/block-registry.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/page-builder/shared-content-blocks.md] link "/openwiki/page-builder/shared-content-blocks.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **Marketing page builder work** — [Page builder block registry](/openwiki/page-builder/block-registry.md) and [Shared content blocks](/openwiki/page-builder/shared-content-blocks.md); sync seed definitions with `node apps/marketing-site/scripts/sync-page-builder-seed.mjs`, apply with `pnpm --filter marketing-site page-builder` (needs `EMDASH_TOKEN`).
<!-- openwiki: broken internal link [/openwiki/ui/design-system.md] link "/openwiki/ui/design-system.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **Styling or theming** — [Shared UI design system](/openwiki/ui/design-system.md); palette changes stay in `packages/ui/src/styles/` with AA contrast in both modes.
<!-- openwiki: broken internal link [/openwiki/operations/deployment-pipeline.md] link "/openwiki/operations/deployment-pipeline.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/operations/database-migrations.md] link "/openwiki/operations/database-migrations.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **Deploy, promote, or recover** — [Deployment pipeline](/openwiki/operations/deployment-pipeline.md) and [Database migration management](/openwiki/operations/database-migrations.md); secrets wizard: `scripts/wizards/deploy-secrets.sh`.
<!-- openwiki: broken internal link [/openwiki/operations/publishing-workflow.md] link "/openwiki/operations/publishing-workflow.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **Draft or publish content** — [Publishing workflow and MCP access](/openwiki/operations/publishing-workflow.md): run the token-owner preflight, draft via `pnpm -s mcp:staging`, James publishes in the admin.
<!-- openwiki: broken internal link [/openwiki/integrations/plugin-topology.md] link "/openwiki/integrations/plugin-topology.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **Plugins** — [Plugin topology](/openwiki/integrations/plugin-topology.md): native SEO/code-block/page-builder vs the sandboxed AI comment moderation on marketing.
<!-- openwiki: broken internal link [/openwiki/operations/verification-suite.md] link "/openwiki/operations/verification-suite.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **Checks failing** — [Verification and quality checks](/openwiki/operations/verification-suite.md) explains the test layout, rendered-SEO script, smoke checks, and accessibility scans.

## Standing rules

Content routes stay server-rendered (`output: "server"`); every content route sets `Astro.cache.set(cacheHint)`; image fields are `{ src, alt }` rendered with `<Image image={...} />`; `entry.id` is the URL slug and `entry.data.id` the database ULID; taxonomy queries match the seed's exact names (`category`, `tag`); each app's `src/live.config.ts` loader boilerplate stays unchanged; telemetry stays disabled everywhere; user-visible copy belongs to James.
