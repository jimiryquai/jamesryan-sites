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

**Status:** ready-for-agent

- [ ] A fresh Copilot and a fresh Codex session in a worktree start with no MCP errors (pane output in a comment).
- [ ] The config holds no machine-specific path and no unpinned package; each server's telemetry is checked and recorded.
- [ ] `docs/` says how to reach the site's MCP (local or staging) and why.

## Comments

**2026-11-09 Claude (orchestrator):** Raised after James asked about the Copilot helper's errors: "we need to find a fix for any issues as our agent workflow depends on not having any." Risk: medium (agent config across harnesses; possibly a token's scope).
