# Reaching EmDash MCP servers

MCP configurations live under `config/` and use `mcporter` 0.17.0's direct Streamable HTTP transport (`"type": "http"`, `"lifecycle": "ephemeral"`, `"imports": []`) with no `mcp-remote` subprocesses, shell wrappers, or machine-specific paths.

## Config files and servers

| Config file | Symlink | Servers | When loaded | Auth variable |
| --- | --- | --- | --- | --- |
| `config/mcporter.json` | `.mcp.json` | `emdash-docs` (`https://docs.emdashcms.com/mcp`) | Automatically at harness start and bare `pnpm exec mcporter` | None (public HTTPS) |
| `config/mcporter.staging.json` | — | `emdash-staging-agent` (`https://staging.jamesryan.dev/_emdash/api/mcp`) | On request via `pnpm mcp:staging` or `--config` | `EMDASH_AGENT_STAGING_TOKEN` |
| `config/mcporter.local.json` | — | `emdash-site` (`http://localhost:4321/_emdash/api/mcp`), `emdash-garden` (`http://localhost:4322/_emdash/api/mcp`) | On request via `pnpm mcp:local` or `--config` | `EMDASH_SITE_PAT`, `EMDASH_GARDEN_PAT` |

Each config sets `"imports": []` so `mcporter` lists only this repository's servers instead of importing user-level editor configs (`~/.claude.json`, `~/.config/opencode/`).

## Commands

### EmDash documentation (`emdash-docs`)

Run from the repository root with no extra flags or environment variables:

```sh
pnpm exec mcporter list
pnpm exec mcporter call emdash-docs.search_docs query:"MCP server authentication"
```

Done when `mcporter list` reports `emdash-docs` healthy and `search_docs` returns matching documentation pages.

### Staging drafts (`emdash-staging-agent`)

`emdash-staging-agent` uses the Contributor token (`content:read`, `content:write`, `media:read`, `media:write`) stored in the gitignored `.env`. Read [`docs/publishing.md`](publishing.md) and run its D1 token-owner preflight before any write.

For read-only inspection or calls from the repository root:

```sh
export WRANGLER_SEND_METRICS=false ASTRO_TELEMETRY_DISABLED=1
pnpm -s mcp:staging list emdash-staging-agent
pnpm -s mcp:staging call emdash-staging-agent.content_list collection:posts limit:5
```

`pnpm mcp:staging` runs `node --env-file-if-exists=.env ./node_modules/mcporter/dist/cli.js --config config/mcporter.staging.json`, loading `.env` into the child process when present without printing secrets on the command line. Pass `-s` (`--silent`) to `pnpm` when piping JSON stdout.

### Local dev databases (`emdash-site` and `emdash-garden`)

1. Start the target app's dev server from the repository root:
   ```sh
   export WRANGLER_SEND_METRICS=false ASTRO_TELEMETRY_DISABLED=1
   pnpm dev          # marketing-site on http://localhost:4321
   pnpm dev:garden   # digital-garden on http://localhost:4322
   ```
   Done when the dev server listens on port `4321` or `4322`.
2. Verify MCP readiness (requires `EMDASH_SITE_PAT` or `EMDASH_GARDEN_PAT` in `.env` or the shell environment):
   ```sh
   pnpm -s mcp:local list
   ```
   Done when the running site reports its tool count instead of `offline — unable to reach server`.
3. Invoke tools against the running local server:
   ```sh
   pnpm -s mcp:local call emdash-site.content_list collection:posts
   pnpm -s mcp:local call emdash-garden.content_list collection:pages
   ```
   Done when the JSON tool response returns from the local SQLite database.

Without a running dev server, `pnpm -s mcp:local list` (or `pnpm exec mcporter --config config/mcporter.local.json list` in a worktree with no `.env`) reports each server as `offline — unable to reach server` alongside the `pnpm dev` / `pnpm dev:garden` command needed to start it.

## Why local and staging site servers live outside `.mcp.json`

### Why `emdash-site` and `emdash-garden` connect only to local dev

1. **Clean startup without a dev server:** `http://localhost:4321/_emdash/api/mcp` and `http://localhost:4322/_emdash/api/mcp` exist only while `pnpm dev` or `pnpm dev:garden` is running. Keeping them in `.mcp.json` made every session that did not start a dev server fail MCP initialization at startup, training humans and agents to ignore MCP errors.
2. **Least-privilege staging access:** Staging write access is owned by `emdash-staging-agent` using a drafts-only Contributor token (see [`docs/publishing.md`](publishing.md)). Pointing `emdash-site` or `emdash-garden` at staging with broader tokens would widen write permissions on a live deployment.

### Why `emdash-staging-agent` also lives in an on-request config

`EMDASH_AGENT_STAGING_TOKEN` is stored in the gitignored `.env` (absent in fresh `git worktree` checkouts) and is unset in normal shell environments. None of the supported harnesses load `.env` automatically when expanding MCP headers:

| Tool | Reads `.mcp.json`? | Env expansion source | Behavior when `EMDASH_AGENT_STAGING_TOKEN` is unset | Source |
| --- | --- | --- | --- | --- |
| Claude Code (`claude`) | Yes (walks ancestor dirs) | `process.env` only (`${VAR}`, `${VAR:-default}`); ignores `.env` | Prints `[Warning] [emdash-staging-agent] ... Missing environment variables: EMDASH_AGENT_STAGING_TOKEN` and sends an unexpanded header that fails with HTTP 401 | [Claude Code MCP docs](https://code.claude.com/docs/en/mcp), `claude mcp list` |
| GitHub Copilot CLI (`copilot`) | Yes (workspace `.mcp.json`) | `process.env` only (`$VAR`, `${VAR}`, `${VAR:-default}`); ignores `.env` | Connects without a valid token, receives HTTP `401` + `WWW-Authenticate` (`/.well-known/oauth-protected-resource`), logs fatal `rmcp` `OAuthChallenge` error, and opens an interactive browser OAuth login (stalling unattended sessions or minting an admin OAuth token instead of the Contributor token) | `copilot mcp --help`, `copilot help environment`, [Copilot CLI docs](https://docs.github.com/copilot/how-tos/copilot-cli) |
| OpenAI Codex CLI (`codex`) | No (`.codex/config.toml`, `~/.codex/config.toml`) | `process.env` only via `bearer_token_env_var`; ignores `.env` | Fails MCP handshake when configured and `bearer_token_env_var` is unset | `codex mcp add --help`, [Codex MCP docs](https://developers.openai.com/codex/mcp/) |
| Antigravity CLI (`agy`) | No (`~/.gemini/config/mcp_config.json`, `.agents/mcp_config.json`) | Static headers only; ignores `.env` and `${VAR}` | Sends literal `${VAR}` header and fails with HTTP 401 if configured | `agy mcp --help`, [Antigravity MCP docs](https://antigravity.google/docs/mcp) |
| MCPorter (`mcporter` 0.17.0) | Yes (`config/mcporter.json`) | `process.env` only (`${VAR}`, `${VAR:-default}`, `$env:VAR`); ignores `.env` | Errors with `Environment variable(s) EMDASH_AGENT_STAGING_TOKEN must be set for MCP header substitution` | `node_modules/mcporter/dist/env.js` |

Keeping `.mcp.json` (`config/mcporter.json`) limited to `emdash-docs` guarantees zero-error startup across every harness and worktree while keeping `emdash-staging-agent`, `emdash-site`, and `emdash-garden` one command away through `pnpm mcp:staging` and `pnpm mcp:local`.
