---
type: architecture overview
title: Monorepo layout and package boundaries
description: The pnpm workspace behind both sites — which package owns the config factory, content helpers, and UI, what each app adds, and the supply-chain policy that governs dependencies.
tags: [monorepo, pnpm, workspace, packages, dependencies]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-67bd0aaac959716a73ab8eb7
    resource: repo://apps/digital-garden/package.json
  - id: openwiki-source-d6089a5bd59eb57767ea33fd
    resource: repo://apps/marketing-site/package.json
  - id: openwiki-source-06a1d1cc2349ce8f1c5069fc
    resource: repo://packages/astro-config/package.json
  - id: openwiki-source-47921affed18ebd8bb559d63
    resource: repo://packages/cms-helpers/package.json
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-02c43abbad2296bba81dd0b3
    resource: repo://scripts/workspace-packages.test.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

The repository is a pnpm workspace (`pnpm-workspace.yaml`) with two deployable apps under `apps/` and three shared packages under `packages/`. Root `package.json` (private, `pnpm@10.28.0`) holds the cross-cutting scripts: `dev`/`dev:garden`/`dev:all`, `build` and `typecheck` (both `pnpm -r --if-present`), `test` (root `node --test scripts/*.test.mjs` first, then recursively), the `mcp:*` mcporter entry points, and `seed:local`.

## Apps

| App | Package | EmDash label | Seed |
| --- | --- | --- | --- |
| `apps/marketing-site` | `marketing-site` | Marketing | `seed/seed.json` |
| `apps/digital-garden` | `digital-garden` | Garden | `seed/seed.json` |

Each app's `emdash` manifest block names its admin label and seed path. Both apps depend on all three shared packages (`workspace:*`) plus the pinned platform set (Astro 7.4.10, EmDash 1.5.0, `@astrojs/cloudflare`, React 19). Marketing alone adds `emdash-plugin-page-builder`, and the sandboxed `emdash-plugin-ai-comment-moderation`, plus the `page-builder` script and a `sync-page-builder-seed.mjs --check` step inside its `typecheck`. The garden keeps the base dependency set. Both apps pin wrangler 4.160.0 and declare `@cloudflare/workers-types`.

App dev/build/typecheck scripts embed `ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false`; `scripts/workspace-packages.test.mjs` asserts the garden's scripts keep that prefix and that stale dependencies (`kysely`, `ulidx`) stay out, and that every workspace member exposes `typecheck` so the root recursive run covers the whole tree.

## Shared packages

<!-- openwiki: broken internal link [/openwiki/architecture/site-config-factory.md] link "/openwiki/architecture/site-config-factory.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **`@jamesryan/astro-config`** exports only `.` (the `createSiteConfig` factory in `index.mjs`) and `./worker` (the Cloudflare entrypoint re-export with `PluginBridge`). It owns the platform dependency pins — Astro, the Cloudflare adapter, EmDash and `@emdash-cms/cloudflare`, Tailwind v4, iconset, the SEO plugin and `astro-seo-graph` validators — so both apps inherit one tested wiring. See [Site config factory](/openwiki/architecture/site-config-factory.md).
- **`@jamesryan/cms-helpers`** publishes TypeScript sources directly (no build step): `.` (content queries, published-route gating, URL mapping, safe HTML, markdown conversion, site identity), `./og`, `./reading-time`, `./discovery`, and `./taxonomy-archive`. Its `typecheck` first verifies the embedded OG font module is up to date via `scripts/embed-og-fonts.mjs --check`.
<!-- openwiki: broken internal link [/openwiki/ui/design-system.md] link "/openwiki/ui/design-system.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
- **`@jamesryan/ui`** owns the shared look: `./styles/palette.css`, `./styles/globals.css`, `./components/*`, `./assets/*`, `./seo-graph`, plus generated collection types it surfaces. It depends on `cms-helpers` for reading-time and identity helpers. See [Shared UI design system](/openwiki/ui/design-system.md).

## Dependency policy

`pnpm-workspace.yaml` implements a deliberate supply-chain stance:

- `allowBuilds` permits postinstall builds only for `esbuild` and `workd`; `better-sqlite3` and `sharp` are explicitly denied.
- `blockExoticSubdeps: true`.
- `minimumReleaseAge: 1440` (one day) holds back brand-new npm releases, with `minimumReleaseAgeExclude` carve-outs only for the EmDash family and the three pinned first-party plugin versions still resolved in the lockfile.

<!-- openwiki: broken internal link [/openwiki/integrations/plugin-topology.md] link "/openwiki/integrations/plugin-topology.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Version exceptions are documented in `docs/dependency-overrides.md`; the Astro 7 upgrade notes live in `docs/astro-7-upgrade.md`. All plugins are installed from npm — their sources live in sibling repositories, never vendored here (see [Plugin topology](/openwiki/integrations/plugin-topology.md)).
