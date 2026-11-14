---
type: orientation
title: Quickstart
description: Orientation for the jamesryan-sites monorepo — what lives where, how to run and check it locally, and which wiki page owns each task.
tags: [orientation, quickstart, monorepo, task-routing]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T00:00:45.144Z
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
generated: { by: "claude-code", at: "2026-11-14T00:00:45.144Z" }
---

James Ryan's sites: a pnpm monorepo building two Astro 7 apps on EmDash 1.5 and Cloudflare Workers — `apps/marketing-site` (jamesryan.dev, staging.jamesryan.dev) and `apps/digital-garden` (jamesryan.me, staging only). Three shared packages under `packages/` carry the platform: `@jamesryan/astro-config` (the `createSiteConfig` factory and worker entrypoint), `@jamesryan/cms-helpers` (published-route gating, URL mapping, discovery endpoints, OG images), and `@jamesryan/ui` (olive palette, WCAG 2.2 AA, Astro primitives). Full layout in [Monorepo layout](architecture/monorepo-layout.md).

## Everyday commands

```bash
export ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false   # always
pnpm install
pnpm dev          # marketing-site on :4321
pnpm dev:garden   # digital-garden on :4322
pnpm typecheck && pnpm build && pnpm test
pnpm seed:local   # apply the marketing seed to real local D1/R2 (build first)
```

Fresh local database order: `pnpm build` → `pnpm seed:local` → `pnpm dev`, only then open the admin (or its dev-bypass) — see [Local seeding workflows](content/local-seeding.md).

## Task routing

- **Build a site feature** (routes, content queries, Portable Text, taxonomies, widgets, SEO, comments, bylines) — start at [Published-route boundary](routing/published-route-boundary.md) and [Live content collections](content/live-content-collections.md); discovery endpoints and `/og/*` have their own pages under [Routing](routing/discovery-endpoints.md).
- **Marketing page builder work** — [Page builder block registry](page-builder/block-registry.md) and [Shared content blocks](page-builder/shared-content-blocks.md); sync seed definitions with `node apps/marketing-site/scripts/sync-page-builder-seed.mjs`, apply with `pnpm --filter marketing-site page-builder` (needs `EMDASH_TOKEN`).
- **Styling or theming** — [Shared UI design system](ui/design-system.md); palette changes stay in `packages/ui/src/styles/` with AA contrast in both modes.
- **Deploy, promote, or recover** — [Deployment pipeline](operations/deployment-pipeline.md) and [Database migration management](operations/database-migrations.md); secrets wizard: `scripts/wizards/deploy-secrets.sh`.
- **Draft or publish content** — [Publishing workflow and MCP access](operations/publishing-workflow.md): run the token-owner preflight, draft via `pnpm -s mcp:staging`, James publishes in the admin.
- **Plugins** — [Plugin topology](integrations/plugin-topology.md): native SEO/code-block/page-builder vs the sandboxed AI comment moderation on marketing.
- **Checks failing** — [Verification and quality checks](operations/verification-suite.md) explains the test layout, rendered-SEO script, smoke checks, and accessibility scans.

## Using the evidence index

The repository's `AGENTS.md` describes OpenWiki as optional context for a concrete question: a requested lookup, unfamiliar architecture or dependency behavior, or an uncertainty left by source inspection. It points readers to `openwiki_search` and then `openwiki_read` for relevant complete sections; when retrieval tools are unavailable, this Quickstart's task map provides the fallback. Source code and tests remain authoritative, and a brief's unknowns are verification gaps rather than automatic requirements. See [the repository guidance](../AGENTS.md#openwiki).

## Standing rules

Content routes stay server-rendered (`output: "server"`); every content route sets `Astro.cache.set(cacheHint)`; image fields are `{ src, alt }` rendered with `<Image image={...} />`; `entry.id` is the URL slug and `entry.data.id` the database ULID; taxonomy queries match the seed's exact names (`category`, `tag`); each app's `src/live.config.ts` loader boilerplate stays unchanged; telemetry stays disabled everywhere; user-visible copy belongs to James.
