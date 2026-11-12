# 27-73d8bfd3: Reach the Cloudflare MCP server through an on-request mcporter config

**Spec:** none.

**What to build:**

James wants Cloudflare's agent tooling (2026-11-12, https://github.com/cloudflare/skills). Its plugin bundles 22 skills and the Cloudflare "Code Mode" MCP server (`https://mcp.cloudflare.com/mcp`, OAuth, live account and API access), and installing the plugin turns that server on in every session. Decision (James, 2026-11-12, "can't we just use mcporter with the mcp server?"): the skills install through agent-workflow (its ticket 29-5e6144d5), and the MCP server is reached on request through mcporter, like `emdash-staging-agent` (ticket 22), never from `.mcp.json`. An OAuth server in an always-loaded config makes harnesses open browser logins and mint grants as whoever is signed in (ticket 22's staging admin grant).

1. Add `config/mcporter.cloudflare.json` with the `cloudflare` server and a `pnpm -s mcp:cloudflare` script beside `mcp:staging` and `mcp:local`. Document it in `docs/mcp.md`: what it can reach, that James signs in once himself and picks the narrowest scopes (read-only to start), where mcporter caches the grant, and how to revoke it (Cloudflare dashboard and the local cache).
2. Telemetry: check the server and mcporter's OAuth path for anything sent beyond the MCP calls, and record it in `docs/mcp.md`.
3. Agents never start the sign-in. If `pnpm -s mcp:cloudflare list` needs a grant and none is cached, it must fail with a message naming the one command James runs, not open a browser unattended. Find out whether mcporter can be told not to start OAuth on its own; if it can't, say so and make the script refuse to run without a cached grant.

**Blocked by:** none.

**Status:** needs-james

- [x] `pnpm -s mcp:cloudflare` reaches the Cloudflare MCP server from an on-request config; with no cached grant it fails with the sign-in command instead of opening a browser (test, and the output in a comment).
- [x] `docs/mcp.md` covers scopes, the grant's cache and revocation, and the telemetry check; `.mcp.json` is unchanged.
- [ ] After James signs in read-only, `pnpm -s mcp:cloudflare list` shows the server healthy (orchestrator; output in a comment).

## Comments

**2026-11-12 Claude (orchestrator):** Raised from James's question. Risk: high (OAuth access to the Cloudflare account; the config decides when a browser login can start).

**2026-11-12 Claude (orchestrator):** The helper stopped on telemetry: Cloudflare's MCP server logs tool name, user ID and error code per call on its side (`cloudflare/mcp` `src/metrics.ts`). James decided "yes": accept it, record it in `docs/mcp.md`. Resumed with mcporter `--no-oauth` as the guard.

**2026-11-12 Claude (orchestrator):** Built by h27-copilot (Copilot, GPT-6.1 Terra), PR #32, merged to master as d650bb3.
- **Who merged it:** the merge happened at 15:37 under James's GitHub account, before the orchestrator's CI re-run finished. The helper only opened the PR (its session log shows `gh pr create` and no merge). The orchestrator has asked the page-builder session whether it merged it. The orchestrator's review and CI re-run (exit 0) both pass after the fact.
- **The guard:** `pnpm -s mcp:cloudflare` runs `scripts/mcp-no-oauth.mjs`, which allows only `list`, `call` and `resource`, always passes `--no-oauth`, and sets `MCPORTER_OAUTH_NO_BROWSER=1`.
- **Box 1:** run by the orchestrator with no grant. It opened no browser and printed `cloudflare (auth required …)` and `If authorization is required, ask James to run: pnpm exec mcporter --config config/mcporter.cloudflare.json auth cloudflare`.
- **Box 2:** `docs/mcp.md` covers scopes, the cache and revocation, and the telemetry decision.
- **Box 3** waits on James signing in, read-only.

