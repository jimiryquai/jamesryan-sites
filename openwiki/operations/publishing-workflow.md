---
type: operations workflow
title: Publishing workflow and MCP access
description: The agent-drafts, human-publishes split for posts, the staging token-owner preflight that gates every write, and the mcporter config layout for docs, staging, local, and Cloudflare MCP servers.
tags: [publishing, mcp, mcporter, emdash, tokens, access-control]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-ad3a1f26624a13c5405f9991
    resource: repo://config/mcporter.local.json
  - id: openwiki-source-29a2c8f2d5062bd2704c0b57
    resource: repo://config/mcporter.staging.json
  - id: openwiki-source-901e7aceec6f8736d86de9d4
    resource: repo://docs/mcp.md
  - id: openwiki-source-b4b124a71e74ba72bfbe44ae
    resource: repo://docs/publishing.md
  - id: openwiki-source-72b6fb1dbd368106ace43ad1
    resource: repo://scripts/mcp-no-oauth.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

## Division of labor

Agents **draft**; James reviews and publishes (and deletes) in the EmDash admin — `https://staging.jamesryan.dev/_emdash/admin` for staging. Staging credentials are never used for production, and the production site is not reachable with the agent token set. Drafts carry `title` (one H1), an `excerpt`, `seo.title` without the ` — James Ryan` suffix (rendered title 30–65 chars), `seo.description` (70–200 chars, unique), and meaningful `alt` text on every image. User-visible copy is James's to approve.

## Token-owner preflight (before any write)

The `emdash-staging-agent` token is a Contributor token in name only — a token minted while an admin was signed in belongs to that admin and carries admin permissions, which once let a test publish unexpectedly. Staging's `/_emdash/api/auth/me` returns 403 for the Contributor role, so ownership is verified directly in D1: the preflight (`docs/publishing.md`) hashes the exact `.env` token locally with SHA-256/base64url, runs a read-only `wrangler d1 execute ... --remote` joining `_emdash_api_tokens` to `users`, and **proceeds only on PASS**: exactly one matching row, owned by `agent@jamesryan.dev`, role 20, all four scopes (`content:read`, `content:write`, `media:read`, `media:write`), and not expired. It never prints the token, hash, or SQL; on failure it stops for an administrator rather than inferring the role from the token's name.

## Drafting through mcporter

`pnpm -s mcp:staging` loads `EMDASH_AGENT_STAGING_TOKEN` from the gitignored `.env` (`--env-file-if-exists`) and targets `config/mcporter.staging.json`. The flow: `media_upload` (inline `base64:` or `base64=@file` for large images; record `item.id`, `url`, `width`, `height`), then `content_create` with a draft payload whose Portable Text body may mix ordinary blocks, `code-block-pro` blocks (a plugin block, not a Markdown fence), and image references carrying alt text. Drafts are created without a published status; revisions fetch a fresh `_rev` via `content_get` and pass it to `content_update`. James is told the post id and slug; after he publishes, the agent checks the rendered post, metadata, comments, and staging validators.

## mcporter configuration layout

All configs use mcporter 0.17.0's direct Streamable HTTP transport (`"type": "http"`, `"lifecycle": "ephemeral"`, `"imports": []` — no `mcp-remote` subprocesses, and imports stay empty so user-level editor configs are never merged):

| Config | Servers | Loaded | Auth |
| --- | --- | --- | --- |
| `config/mcporter.json` (symlinked to `.mcp.json`) | `emdash-docs` (public EmDash docs) | Automatically at harness start | none |
| `config/mcporter.staging.json` | `emdash-staging-agent` (staging MCP endpoint) | `pnpm -s mcp:staging` | `EMDASH_AGENT_STAGING_TOKEN` |
| `config/mcporter.local.json` | `emdash-site` (:4321), `emdash-garden` (:4322) | `pnpm -s mcp:local` (dev servers running) | `EMDASH_SITE_PAT`, `EMDASH_GARDEN_PAT` |
| `config/mcporter.cloudflare.json` | `cloudflare` (Code Mode API server) | `pnpm -s mcp:cloudflare` | OAuth grant, James only |

The split exists because no harness expands `.env` into MCP headers: a token-bearing server in `.mcp.json` would fail (or worse, trigger interactive browser OAuth) in every fresh worktree. Keeping `.mcp.json` to the public docs server guarantees zero-error startup everywhere.

### Cloudflare wrapper

`scripts/mcp-no-oauth.mjs` (`mcp:cloudflare`) wraps mcporter with `--no-oauth` and allows only `list`, `call`, and `resource` (rejecting `--config`/`--root` argument injection), so an agent can never start or renew an OAuth grant; a missing or expired grant fails with the `auth` command printed for James, who starts the interactive grant himself with narrowest-read permissions. `docs/mcp.md` records a telemetry audit of every piece (mcporter, EmDash's built-in MCP transport, wrangler, the docs endpoint, and Cloudflare's server-side usage metrics James accepted) — no client telemetry is sent.
