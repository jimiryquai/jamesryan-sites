# Reaching MCP servers

MCP configurations live under `config/` and use `mcporter` 0.17.0's direct Streamable HTTP transport (`"type": "http"`, `"lifecycle": "ephemeral"`, `"imports": []`) with no `mcp-remote` subprocesses, shell wrappers, or machine-specific paths.

## Config files and servers

| Config file | Symlink | Servers | When loaded | Auth variable |
| --- | --- | --- | --- | --- |
| `config/mcporter.json` | `.mcp.json` | `emdash-docs` (`https://docs.emdashcms.com/mcp`) | Automatically at harness start and bare `pnpm exec mcporter` (see [`AGENTS.md`](../AGENTS.md)) | None (public HTTPS) |
| `config/mcporter.staging.json` | — | `emdash-staging-agent` (`https://staging.jamesryan.dev/_emdash/api/mcp`) | On request via `pnpm -s mcp:staging` | `EMDASH_AGENT_STAGING_TOKEN` |
| `config/mcporter.local.json` | — | `emdash-site` (`http://localhost:4321/_emdash/api/mcp`), `emdash-garden` (`http://localhost:4322/_emdash/api/mcp`) | On request via `pnpm -s mcp:local` | `EMDASH_SITE_PAT`, `EMDASH_GARDEN_PAT` |
| `config/mcporter.cloudflare.json` | — | `cloudflare` (`https://mcp.cloudflare.com/mcp`) | On request via `pnpm -s mcp:cloudflare` | OAuth grant |

Each config sets `"imports": []` so `mcporter` lists only this repository's servers instead of importing user-level editor configs (`~/.claude.json`, `~/.config/opencode/`).

## Commands

### Staging drafts (`emdash-staging-agent`)

`emdash-staging-agent` uses the Contributor token (`content:read`, `content:write`, `media:read`, `media:write`) stored in the gitignored `.env`. Read [`docs/publishing.md`](publishing.md) and complete its D1 token-owner preflight before any write.

For read-only inspection or calls from the repository root:

```sh
export WRANGLER_SEND_METRICS=false ASTRO_TELEMETRY_DISABLED=1
pnpm -s mcp:staging list emdash-staging-agent
pnpm -s mcp:staging call emdash-staging-agent.content_list collection:posts limit:5
```

Pass `-s` (`--silent`) to `pnpm` so stdout contains only `mcporter` output when parsing JSON.

### Cloudflare API (`cloudflare`)

Cloudflare's Code Mode server can search its API and documentation and execute calls across Cloudflare services, subject to the granted permissions. It can change live resources if granted write scopes. It is never loaded through `.mcp.json`.

Only James starts or renews the interactive grant, from the repository root:

```sh
pnpm exec mcporter --config config/mcporter.cloudflare.json auth cloudflare
```

In the consent screens, select only the account and read permissions needed, starting with the narrowest read-only access. Cloudflare's server requires `user:read`, `account:read`, and `offline_access` for identity, account discovery, and refresh; its Minimal preset starts there. Its Read only preset covers many products, so narrow optional permissions where possible. Cloudflare may request additional scopes for a refused operation; agents must not approve or start a new sign-in. Sources: [Cloudflare MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/), [scope definitions](https://github.com/cloudflare/mcp/blob/main/src/auth/scopes.ts), and [OAuth consent](https://developers.cloudflare.com/fundamentals/oauth/authorizing-an-application/) (read 2026-11-12).

After James signs in, use `pnpm -s mcp:cloudflare list` or `pnpm -s mcp:cloudflare call cloudflare.<tool> ...`. The wrapper supports `list`, `call`, and `resource` only and enforces mcporter's `--no-oauth`; a missing, expired, or rejected grant fails instead of starting OAuth. Refreshing a cached grant may contact the OAuth token endpoint. If authorization is required, the wrapper prints the command above for James.

mcporter stores its OAuth vault at `$XDG_DATA_HOME/mcporter/credentials.json` when `XDG_DATA_HOME` is absolute, otherwise `~/.mcporter/credentials.json` (with possible legacy files under `~/.mcporter/cloudflare/`). Treat it as a secret; encryption depends on mcporter's vault configuration. To revoke access, James should revoke the Cloudflare application under [Manage OAuth authorizations](https://dash.cloudflare.com/?to=/profile/access-management/authorization), then clear local cached credentials:

```sh
pnpm exec mcporter --config config/mcporter.cloudflare.json config logout cloudflare
```

Clearing local credentials alone does not revoke the server-side authorization.

### Local dev databases (`emdash-site` and `emdash-garden`)

1. Start the target app's dev server from the repository root:
   ```sh
   export WRANGLER_SEND_METRICS=false ASTRO_TELEMETRY_DISABLED=1
   pnpm dev          # marketing-site on http://localhost:4321
   pnpm dev:garden   # digital-garden on http://localhost:4322
   ```
   Done when the dev server listens on port `4321` or `4322`.
2. Verify MCP readiness with `.env` containing `EMDASH_SITE_PAT` and `EMDASH_GARDEN_PAT` (or those variables exported in the shell):
   ```sh
   pnpm -s mcp:local list
   ```
   Done when the running site reports its tool count instead of `offline — unable to reach server`. Without a running dev server, `pnpm -s mcp:local list` marks each closed port `offline` alongside its `pnpm dev` / `pnpm dev:garden` command; without PATs, `mcporter` fails fast before making unauthenticated HTTP requests.
3. Invoke tools against the running local server:
   ```sh
   pnpm -s mcp:local call emdash-site.content_list collection:posts
   pnpm -s mcp:local call emdash-garden.content_list collection:pages
   ```
   Done when the JSON tool response returns from the local SQLite database.

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

Keeping `.mcp.json` (`config/mcporter.json`) limited to `emdash-docs` guarantees zero-error startup across every harness and worktree while keeping `emdash-staging-agent`, `emdash-site`, and `emdash-garden` one command away through `pnpm -s mcp:staging` and `pnpm -s mcp:local`.

## Telemetry audit (checked 2026-11-12)

- **`mcp-remote`:** Removed completely; no `npx` or runtime package downloads remain in any config.
- **`mcporter` `0.17.0` (pinned exact in root `package.json`):** `node_modules/mcporter/dist/` contains no analytics or telemetry SDKs or reporting endpoints; outbound HTTP requests target only the configured MCP server URL, sending standard MCP `clientInfo` metadata (`clientName`).
- **`emdash-site`, `emdash-garden`, and `emdash-staging-agent` (`emdash` `1.4.0` built-in `/_emdash/api/mcp`):** `emdash/src/astro/routes/api/mcp.ts` and `emdash/src/mcp/` run a stateless `WebStandardStreamableHTTPServerTransport` against the app's own D1/SQLite database with zero third-party telemetry or phone-home requests. Set `WRANGLER_SEND_METRICS=false` and `ASTRO_TELEMETRY_DISABLED=1` when starting local Astro/Wrangler dev servers.
- **`emdash-docs` (`https://docs.emdashcms.com/mcp`):** Remote public Streamable HTTP endpoint operated by EmDash; runs no local code and receives requests only when `emdash-docs` is listed or queried (`"lifecycle": "ephemeral"`).
- **Cloudflare API MCP:** mcporter's OAuth flow also contacts the server's discovery, registration and token endpoints and, for interactive authorization, the browser authorization endpoint; cached tokens can be refreshed. No separate mcporter analytics endpoint was found in the pinned local source. Cloudflare's production server records server-side usage metrics: [source](https://github.com/cloudflare/mcp/blob/main/src/metrics.ts) and [production binding](https://github.com/cloudflare/mcp/blob/main/wrangler.jsonc) (read 2026-11-12) show tool name, user ID for user credentials and error code per call, auth and schema-mismatch events, and HTTP-layer User-Agent; schema-mismatch metrics contain no response values. Logs and traces are also enabled in the checked configuration. James accepted Cloudflare's server-side usage metrics on 2026-11-12; this is separate from local tool telemetry.
