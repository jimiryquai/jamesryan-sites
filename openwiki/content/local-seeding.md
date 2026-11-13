---
type: development workflow
title: Local seeding workflows
description: How seed-local.mjs applies a seed to real local D1/R2 state, how seed-media.mjs rebuilds committed assets from a live site's media table, and how dev-bypass recovers local admin access.
tags: [seeding, local-development, d1, r2, wrangler, emdash-cli]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-d6d6ab2589aefa6273a24626
    resource: repo://scripts/seed-local.mjs
  - id: openwiki-source-8a576d7021d682315ecac9f3
    resource: repo://scripts/seed-local.test.mjs
  - id: openwiki-source-1a52767ed1502d427867b01b
    resource: repo://scripts/seed-media.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

## Why seeding is a CLI step

A Cloudflare Worker cannot read seed assets from the Node filesystem, so local R2 media only exists after the seed is applied through the CLI **before** `pnpm dev`. The documented fresh-database order is `pnpm build` → `pnpm seed:local` → `pnpm dev`, and only then open setup or the dev-bypass.

## `scripts/seed-local.mjs`

Run as `pnpm seed:local` (defaults to `apps/marketing-site`), or directly with `[app] [seed] [state-dir]` overrides. It:

1. Reads the app's built `dist/server/wrangler.json` (hence build-first) to find the `MEDIA` bucket name, and the app manifest's `emdash.seed` path.
2. Pokes the local D1 database once with `wrangler d1 execute ... --local --persist-to` so Wrangler materializes `.wrangler/state/v3/d1`, then locates the single `*.sqlite` file (excluding `metadata.sqlite`) — a count other than one is an error.
3. Runs `emdash seed <seed.json> --database <sqlite> --uploads-dir .wrangler/state/seed-uploads`. EmDash 1.5's native `$media.file` handling reuses upload, dimensions, and hash deduplication; it rejects absolute paths, parent-path escapes, and symlink escapes.
4. Reads the `media` table directly with `node:sqlite` (`DatabaseSync`) and copies each staged upload into local R2 with `wrangler r2 object put <bucket>/<storage_key> --local`, using the row's `mime_type` and the same persist directory.
5. Prints the database path, state directory, seed path, bucket, and the media rows as JSON.

Staged uploads are deliberately kept, so a run that fails during the R2 copy is repaired by rerunning; on rerun EmDash reuses existing rows and writes no new upload for them, so the copy loop is idempotent. Every spawned command forces `WRANGLER_SEND_METRICS=false` and `ASTRO_TELEMETRY_DISABLED=1`. `scripts/seed-local.test.mjs` exercises the real CLI end-to-end (original bytes preserved, per-use alt/caption attached, escape attempts rejected).

## `scripts/seed-media.mjs`

Repairs a seed whose media references point at a live site: export the source site's `media` table with `wrangler d1 execute ... --remote --command 'SELECT * FROM media' --json`, then run `node scripts/seed-media.mjs apps/marketing-site/seed/seed.json media-rows.json https://staging.jamesryan.dev`.

`rewriteSeedMedia(seed, mediaRows)` walks the seed and rewrites every image reference — Portable Text `image/asset` nodes, bare `$media` objects, and `provider: 'local'` uploads — into `{ $media: { file: "assets/<filename>" } }`, resolving each against the exported rows by id or storage-key suffix. It preserves the content's alt text and captions (taking the row's only as `libraryCaption`), rejects filename collisions between different sources, and refuses when two different URLs map to one file. The CLI then downloads each image from the origin (verifying an `image/*` content type), writes it with `wx` so it never clobbers differing bytes, re-verifies every referenced file on reruns, and rewrites `seed.json`. Both JSON and assets get committed for review.

## Recovering local admin access

Local passkeys can be lost or invalidated; each app exposes a development-only bypass that restores admin access without credentials:

- marketing: `http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`
- garden: `http://localhost:4322/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`

<!-- openwiki: broken internal link [/openwiki/operations/verification-suite.md] link "/openwiki/operations/verification-suite.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Seed-first matters here too: opening setup or dev-bypass against an empty database creates state you would otherwise seed over. The rendered-SEO check uses the same seeding machinery against isolated storage ([Verification and quality checks](/openwiki/operations/verification-suite.md)).
