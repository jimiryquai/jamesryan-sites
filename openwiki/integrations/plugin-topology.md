---
type: integration topology
title: Plugin topology
description: Which EmDash plugins run where — native in-process SEO, code-block-pro, and page-builder versus the sandboxed AI comment moderation plugin — and the secrets and smoke check the moderator needs.
tags: [emdash, plugins, sandbox, worker-loader, comment-moderation, secrets]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-6fcf62658729324461e93e00
    resource: repo://apps/marketing-site/astro.config.mjs
  - id: openwiki-source-2259063a20830409cc3a930b
    resource: repo://docs/deploying.md
  - id: openwiki-source-fdc3598f8adeb795fc2861ab
    resource: repo://packages/astro-config/index.mjs
  - id: openwiki-source-82d309dddec1671f537796f2
    resource: repo://packages/astro-config/worker.ts
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-8227991ebcffe7157652d6ff
    resource: repo://scripts/check-comment-moderation.mjs
  - id: openwiki-source-02227a9a8b26a7c3085c8158
    resource: repo://scripts/wizards/deploy-secrets.sh
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

All plugins are installed from npm; their sources live in sibling repositories (`../emdash-plugin-code-block-pro`, `../emdash-plugin-page-builder`, `../emdash-plugin-ai-comment-moderation`, and upstream for `@jdevalk/emdash-plugin-seo`) and are never vendored into this repo. This page covers only the wiring and configuration visible here.

## Native, in-process plugins

Native plugins run inside the app Worker process. The shared set is decided once in `createSiteConfig`:

- **`@jdevalk/emdash-plugin-seo`** (both apps) — third-party SEO plugin. SEO 0.12's descriptor paths are stripped by EmDash 1.4's `definePlugin`, so the factory patches `entrypoint`/`adminEntry` to the installed `src/index.ts` / `src/admin.tsx` resolved against each app's `appRootUrl` (`packages/astro-config/index.mjs`).
- **`emdash-plugin-code-block-pro`** (both apps) — Portable Text rendering components must be native, so the code-block renderer runs in-process everywhere.

<!-- openwiki: broken internal link [/openwiki/page-builder/block-registry.md] link "/openwiki/page-builder/block-registry.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Marketing passes one extra native plugin: **`emdash-plugin-page-builder`**, via `extraPlugins` in `apps/marketing-site/astro.config.mjs`. It owns the `layout` blocks field on the pages collection and the admin builder; the site side is described in [Page builder block registry](/openwiki/page-builder/block-registry.md).

## Sandboxed plugin

<!-- openwiki: broken internal link [/openwiki/architecture/cloudflare-emdash-runtime.md] link "/openwiki/architecture/cloudflare-emdash-runtime.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
**`emdash-plugin-ai-comment-moderation`** runs only on marketing, passed as `sandboxedPlugins: [aiCommentModeration]`. The factory forwards it to EmDash's `sandboxed` list with `sandboxRunner: sandbox()` from `@emdash-cms/cloudflare`: the plugin's code executes inside a Worker Loader sandbox reached through the `LOADER` binding, talking to the host over the `PluginBridge` that the shared worker entrypoint re-exports ([Cloudflare and EmDash runtime](/openwiki/architecture/cloudflare-emdash-runtime.md)). The garden declares no sandboxed plugins, but keeps the `LOADER` binding in both environments.

### Secrets and configuration

`scripts/wizards/deploy-secrets.sh` generates a separate `EMDASH_ENCRYPTION_KEY` for each marketing Worker (`wrangler secret put EMDASH_ENCRYPTION_KEY --env staging`, then production) — the key stage needs Wrangler authenticated to the intended account, keys are stored in a password manager apart from D1 backups, and a target that already has a key is skipped because replacing it renders existing encrypted settings unreadable. After deployment, the moderator's EmDash admin settings take the Cloudflare account ID, a Workers AI API token (encrypted at rest), and an optional model; without working AI credentials the plugin falls back to the collection's standard moderation policy rather than spam/toxicity classification.

### Moderation smoke check

`scripts/check-comment-moderation.mjs` (run by the staging deploy for marketing) authenticates with the `EMDASH_COMMENT_SMOKE_TOKEN` GitHub secret — an administrator-owned staging personal-access token whose owner role must also grant comment moderate/delete and content read. It picks the first published post (comments enabled, no closing date, no mandatory Turnstile), then for three labelled comments — clean, obvious spam, toxic — submits via the public comment API, reads the admin status (`approved` / `spam` / `pending` respectively), and permanently deletes each immediately; failed cleanup is reported with the comment id and fails the job. A lost submission response can orphan a comment, so the inbox is inspected for `Moderation smoke test` after interrupted runs, and EmDash's rate limit means repeated runs within ten minutes can 429. The token's own `/_emdash/api/auth/me` payload is redacted to just the role in logs, and the script requires role 50 (administrator).
