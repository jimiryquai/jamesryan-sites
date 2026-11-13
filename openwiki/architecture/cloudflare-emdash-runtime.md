---
type: runtime architecture
title: Cloudflare and EmDash runtime
description: How both Astro apps run as Cloudflare Workers with EmDash on D1, R2, KV, and the Worker Loader sandbox, including per-environment bindings and the runtime migration-check policy.
tags: [cloudflare, workers, emdash, bindings, d1, r2, migrations]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-3d21989964b8080954f80b80
    resource: repo://apps/digital-garden/src/live.config.ts
  - id: openwiki-source-fa198f7b1707ce776f6fd54f
    resource: repo://apps/digital-garden/src/worker.ts
  - id: openwiki-source-c4fb8db14504f634c1aa8108
    resource: repo://apps/digital-garden/wrangler.jsonc
  - id: openwiki-source-c30282be9a1a4864ab62bea5
    resource: repo://apps/marketing-site/src/live.config.ts
  - id: openwiki-source-df6b02bfd3f3b710dfc1464a
    resource: repo://apps/marketing-site/src/worker.ts
  - id: openwiki-source-2661ecf0e5ea152bea16e519
    resource: repo://apps/marketing-site/wrangler.jsonc
  - id: openwiki-source-2259063a20830409cc3a930b
    resource: repo://docs/deploying.md
  - id: openwiki-source-fdc3598f8adeb795fc2861ab
    resource: repo://packages/astro-config/index.mjs
  - id: openwiki-source-82d309dddec1671f537796f2
    resource: repo://packages/astro-config/worker.ts
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

Each app deploys as one Cloudflare Worker whose entrypoint is `src/worker.ts`, a one-line re-export of the shared package's worker: the default export is Astro's Cloudflare server handler and `PluginBridge` comes from `@emdash-cms/cloudflare/sandbox` (`packages/astro-config/worker.ts`), re-exported by both apps so the Worker exposes the sandbox bridge that the `LOADER` binding's plugin sandboxes talk to.

## Bindings and environments

`apps/marketing-site/wrangler.jsonc` (Worker `jamesryan-marketing`, custom domain `jamesryan.dev`) and `apps/digital-garden/wrangler.jsonc` (Worker `jamesryan-me`, no production route) declare the same four bindings in every environment that app deploys to:

- `DB` — the EmDash D1 database.
- `SESSION` — the KV namespace holding session state.
- `MEDIA` — the R2 bucket storing uploaded media.
- `LOADER` — a Worker Loader used for plugin sandboxing.

Each file defines a top-level (production) configuration plus a `staging` environment override with its own D1 database, KV namespace, R2 bucket, Worker Loader, and custom domain (`staging.jamesryan.dev` / `staging.jamesryan.me`). The garden's top-level `routes` array is empty: it is upgraded and deployed to staging only, and production promotion for it has not happened. Marketing additionally sets a top-level `vars.USERMAVEN_KEY` used by the `/s1/*` analytics proxy.

Both configs set `compatibility_date` `2026-02-24` with `nodejs_compat`, and keep telemetry off (`send_metrics: false`, `dependencies_instrumentation: { enabled: false }`), matching the repository-wide rule that no tool sends telemetry.

Astro fixes deployment bindings at **build time** via `CLOUDFLARE_ENV`; passing `--env staging` only at deploy time can leave a Worker built against production bindings. The deploy workflow therefore builds with `CLOUDFLARE_ENV=staging` and then runs `wrangler deploy --env staging`.

## EmDash wiring

The EmDash integration is created once in `createSiteConfig` (`packages/astro-config/index.mjs`):

- `database: d1({ binding: "DB", session: "auto" })` — EmDash reads and writes through the same D1 binding the Worker declares, with automatic session handling.
- `storage: r2({ binding: "MEDIA" })` — media uploads land in the R2 bucket.
- `sandboxRunner: sandbox()` and `sandboxed: sandboxedPlugins` — plugins listed by an app run inside Worker Loader sandboxes through the `LOADER` binding; marketing uses this for AI comment moderation.
- `mcp: true` — exposes EmDash's MCP tools for drafting workflows.
- `plugins: [...]` — the shared native plugin set (SEO and code-block-pro), plus each app's `extraPlugins`.

## Migration runtime policy

Both apps configure EmDash migrations as `{ runtime: "check", dev: "auto" }` (`packages/astro-config/index.mjs`). This policy lives in application configuration because every deployed environment uses the same rule:

- Deployed requests **never** apply migrations or acquire the migration lock; if the schema check knows migrations are pending, the Worker returns 503 rather than serving against a wrong schema.
- Development keeps automatic migrations, so `pnpm dev` applies them on boot.

<!-- openwiki: broken internal link [/openwiki/operations/database-migrations.md] link "/openwiki/operations/database-migrations.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
The rule exists because an earlier `auto` runtime could start migrations inside a Worker on first request, time out, and leave the migration lock held indefinitely (locks left by those old workers are recovered through the CI `recover-lock` path). Migrations are instead applied by the deployment pipeline between build and deploy, verified afterwards with `emdash migrate --check`; see [Database migration management](/openwiki/operations/database-migrations.md).

## Live content loader

<!-- openwiki: broken internal link [/openwiki/content/live-content-collections.md] link "/openwiki/content/live-content-collections.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Each app's `src/live.config.ts` is preserved boilerplate: it defines a single `_emdash` live collection with `emdashLoader()` from `emdash/runtime`, which is the only bridge between Astro's content layer and the D1-backed CMS. EmDash generates each app's `emdash-env.d.ts` collection types from this. Details in [Live content collections](/openwiki/content/live-content-collections.md).
