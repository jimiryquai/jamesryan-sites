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

**Status:** needs-triage

- [ ] mcporter's telemetry is checked from its source, and is off (or shown to be absent), recorded in a comment with the evidence.
- [ ] In each of the three repos, a Codex helper's `mcporter call emdash-docs.search_docs` returns a docs result (output in a comment).
- [ ] Each repo has one source for its MCP server definitions; any other file is derived from it.
- [ ] Each repo's `AGENTS.md` names the mcporter route for the EmDash docs, and no config lists the stale servers.

## Comments
