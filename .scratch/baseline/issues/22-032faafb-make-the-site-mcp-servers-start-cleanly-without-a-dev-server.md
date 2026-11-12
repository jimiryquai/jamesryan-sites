# 22-032faafb: Make the site MCP servers start cleanly without a dev server

**Spec:** docs/specs/baseline.md

**What to build:**

Seen 2026-11-09: every Copilot helper started in a worktree reports `Failed to connect to MCP server "emdash-site"` (and `"emdash-garden"`): `MCP server process exited before completing the MCP initialize handshake`. `config/mcporter.json` (symlinked as `.mcp.json`, ticket 16) defines both as `sh -c` wrappers that:

- run `npx -y mcp-remote` with no pinned version, fetched at every start, and nobody has checked it for telemetry;
- connect to `http://localhost:4321/_emdash/api/mcp`, which only exists while that app's dev server is running, so they fail in every session that hasn't started one, every helper included;
- hard-code `/home/james/.local/share/mise/installs/node/24.12.0/bin` (ticket 16's note), which breaks on any other machine or Node version;
- read `EMDASH_SITE_PAT` and `EMDASH_GARDEN_PAT` from `.env`.

A noisy failure at every start trains everyone to ignore MCP errors, and a real one then gets missed.

Make each harness start without errors, while keeping the site servers usable when someone wants them:

1. **Decide where they connect,** and record why in `docs/`:
   - local dev only, so they leave the always-loaded config and start through an explicit command, such as `pnpm mcp:site`, or a mcporter call that starts the dev server first;
   - or staging, `https://staging.jamesryan.dev/_emdash/api/mcp` with a scoped token, so they work without a dev server.

   Writing through MCP to a live site is ticket 12's concern (a drafts-only token). Don't widen anyone's write access here.
2. **No machine-specific paths:** derive Node from `.node-version`, mise or the PATH, and pin `mcp-remote` as a dev dependency at a checked version (check it for telemetry, as ticket 16 did for mcporter), or replace it if EmDash's MCP supports a direct HTTP transport in mcporter.
3. **Proof:**
   - a fresh Copilot and a fresh Codex session started in a worktree show no MCP errors;
   - `pnpm exec mcporter list` shows each configured server healthy, or clearly marked as needing the dev server;
   - the docs server still works from the repo root.

**Blocked by:** none.

**Status:** done

- [x] A fresh Copilot and a fresh Codex session in a worktree start with no MCP errors (pane output in a comment).
- [x] The config holds no machine-specific path and no unpinned package; each server's telemetry is checked and recorded.
- [x] `docs/` says how to reach the site's MCP (local or staging) and why.

## Comments

**2026-11-09 Claude (orchestrator):** Raised after James asked about the Copilot helper's errors: "we need to find a fix for any issues as our agent workflow depends on not having any." Risk: medium (agent config across harnesses; possibly a token's scope).

**2026-11-12 Claude (orchestrator):** Claimed for h22-agy (agy, Gemini 4 Carbon high; first ticket for Carbon), base `master`. Risk: medium (agent config across harnesses; no token scope widened). The orchestrator runs box 1's fresh Copilot and Codex sessions itself.

**2026-11-12 Claude (orchestrator):** Done. Built by h22-agy (agy, Gemini 4 Carbon high) in 1 round, PR #24, merged to master as bce1e15 and into `baseline` as 285a1bb.
- `.mcp.json` (`config/mcporter.json`) now holds only `emdash-docs`, with `"imports": []`.
- `emdash-site` and `emdash-garden` moved to `config/mcporter.local.json` (`pnpm -s mcp:local`), and `emdash-staging-agent` to `config/mcporter.staging.json` (`pnpm -s mcp:staging`). All use direct HTTP, with no `mcp-remote`, no `sh -c` wrappers and no machine paths.
- Why, per harness, with sources and the telemetry check: `docs/mcp.md`.
- One deviation from the brief, and justified: `emdash-staging-agent` also left the always-loaded config. No harness loads `.env`, so the token is unset, and EmDash answers a 401 with an OAuth challenge. On 2026-11-09 that made Copilot open a browser login and mint an OAuth grant on James's **admin** account on staging (refresh token valid to 2027-02-07). With James's go-ahead, the orchestrator revoked it on 2026-11-12: it deleted the 2 `_emdash_oauth_tokens` rows and the "GitHub Copilot CLI" `_emdash_oauth_clients` row on staging (0 of each left) and Copilot's cached `~/.copilot/mcp-oauth-config/` files. Production has not been checked yet, because auto mode refused the read.
- Box 1, run by the orchestrator in fresh sessions:

```
Box 1, orchestrator, 2026-11-12T10:23:29Z, fresh sessions in /home/james/Repos/Workspace/building/jamesryan-sites/.claude/worktrees/22-mcp-startup at c93f252
== Codex v0.167.0 (/mcp)
🔌  MCP Tools

  • codex_apps: connected (157 tools)
  • codex_tui: connected (12 tools)
  • pencil: connected (9 tools)

  Use /mcp verbose for tools and resources.
Codex startup warnings: 1 (launcher -c flags need embedded mode; not MCP)
== Copilot v1.0.107 (/mcp)
 MCP                                                                                                                                     2/2 enabled
    ◎  emdash-docs                                                                                                                       Repository
       mcp:emdash-docs                                                                                                                   129 tokens
    ◎  GitHub MCP Server                                                                                                                   Built-in
```

- Box 2: `mcporter list` and telemetry evidence; CI re-run locally, exit 0 (41 + 5 tests).
- Box 3: `docs/mcp.md`, linked from AGENTS.md; `docs/publishing.md` uses `pnpm -s mcp:staging`.
- Evidence: `.orchestrate/runs/2026-11-12-22-mcp-startup/`.

