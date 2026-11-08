# 16-4a9e4cde: Give every helper harness the EmDash docs MCP from the repos that use EmDash

**Spec:** docs/specs/baseline.md

**What to build:**

On 2026-11-08 the Codex helpers on tickets 03 and 04 read the EmDash docs from the website, because the docs MCP (`https://docs.emdashcms.com/mcp`) is configured only in this repo's `.mcp.json`, which only Claude Code reads. The server is project knowledge, so it belongs in each repo that uses EmDash, not in agent-workflow (James, 2026-11-08): this repo, `../emdash-plugin-code-block-pro` and `../emdash-plugin-ai-comment-moderation`.

Use **mcporter** (James, 2026-11-08) as the route every harness shares: any helper with a shell calls `mcporter list <server>` and `mcporter call <server>.<tool> …`, so no harness needs its own MCP config. It's installed (0.17.0) and `config/mcporter.json` here already defines `emdash-docs`, `emdash-site` and `emdash-garden`.

1. **Telemetry first.** Check from mcporter's source and docs whether it sends any telemetry or usage data; if it does, switch it off in config or env and record how. If it can't be switched off, stop and record it for James.
2. **One source per repo.** `.mcp.json` and `config/mcporter.json` both define these servers today, with the same `sh -c … .env` wrapper copied into each. Pick one as the source and derive the other (mcporter may import editor configs such as `.mcp.json`; check its docs), recording the direction and why.
3. **Each EmDash repo** pins mcporter as a dev dependency (`mcporter@0.17.0`, or the version step 1 checked), so the CLI is versioned with the config it reads and nothing depends on a machine install; agent-workflow's APM installs skills, not CLIs, and stays out of it (James, 2026-11-08). Agents run it with `pnpm exec mcporter …` here and `npx mcporter …` in the npm-based plugin repos. Each repo gets the docs server through that source, and an `AGENTS.md` line telling agents to read EmDash docs with mcporter (the exact `list` and `call` commands), not the website. The plugin repos have no `AGENTS.md`; create one that holds just this and points to the README.
4. **Clean up** the stale servers: `StitchMCP` and the four Z.ai ones (`web-search-prime`, `zread`, `web-reader`, `zai-mcp-server`), whose skills ticket 01 removed, from every config that lists them (`.mcp.json`, `config/mcporter.json`, `.claude/settings.local.json`'s enabled list), unless something still uses them.

**Blocked by:** none.

**Status:** done

- [x] mcporter's telemetry is checked from its source, and is off (or shown to be absent), recorded in a comment with the evidence.
- [x] In each of the three repos, a Codex helper's `mcporter call emdash-docs.search_docs` returns a docs result (output in a comment).
- [x] Each repo has one source for its MCP server definitions; any other file is derived from it.
- [x] Each repo's `AGENTS.md` names the mcporter route for the EmDash docs, and no config lists the stale servers.

## Comments

**2026-11-08 Claude (orchestrator):** Triaged with James: ready-for-agent. Risk: medium (no docs/agents/review.md; config and instructions agents act on, across three repos; no runtime code).

**2026-11-08 Copilot:** Audited the published mcporter 0.17.0 npm package
and its upstream configuration documentation. The source scan found no
analytics or telemetry service or telemetry-sending implementation in
mcporter's own code. The MCP connection identifies the client to the selected
server as part of the protocol; OAuth registration can also send a client
name to the selected authorization server. These are not a separate usage
report to mcporter's publisher. No telemetry opt-out was needed or found.
Evidence: `.orchestrate/evidence/mcporter-package.txt`,
`.orchestrate/evidence/mcporter-source-scan.txt`,
`.orchestrate/evidence/mcporter-network-audit.txt`, and
`.orchestrate/evidence/mcporter-import-docs.md`.

**2026-11-08 Claude (orchestrator):** Done. Built by h16-copilot (Copilot, GPT-6.1 Terra): jamesryan-sites #9 (merged to `baseline`; lockfile re-resolved on top of 05), jimiryquai/emdash-plugin-code-block-pro#7 and jimiryquai/emdash-plugin-ai-comment-moderation#2 (both merged to `master`; dev-only, no release). mcporter 0.17.0 pinned per repo (needs Node 24). One source each: `config/mcporter.json`, with this repo's `.mcp.json` a symlink to it; stale Stitch and Z.ai servers removed. Telemetry re-checked by the orchestrator in the installed package: no analytics libraries or hosts; the only hit is the `clientName` field MCP sends to the server it calls. Box 2: a fresh Codex session (GPT-6.1 Sol) read each repo's `AGENTS.md` and ran its command; all three returned `<result source="https://docs.emdashcms.com/plugins/overview/" score="1.000">` (evidence `orchestrator-codex-check.txt`). Merged-tree checks pass. For James: the untracked `.claude/settings.local.json` still enables `web-search-prime`, `zread`, `web-reader`, `zai-mcp-server`. For ticket 13: the `emdash-site`/`emdash-garden` server commands hard-code `/home/james/.local/share/mise/installs/node/24.12.0/bin`. Evidence: `.orchestrate/runs/2026-11-08-16-mcporter/`.
