# 16-4a9e4cde: Give every helper harness the EmDash docs MCP from the repos that use EmDash

**Spec:** docs/specs/baseline.md

**What to build:**

On 2026-11-08 the Codex helpers on tickets 03 and 04 read the EmDash docs from the website, because the docs MCP (`https://docs.emdashcms.com/mcp`) is configured only in this repo's `.mcp.json`, which only Claude Code reads. `~/.codex/config.toml` has no such server, and neither plugin repo has an MCP config. The server is project knowledge, so it belongs in each repo that uses EmDash, not in agent-workflow (James, 2026-11-08): this repo, `../emdash-plugin-code-block-pro` and `../emdash-plugin-ai-comment-moderation`.

Find from each harness's own docs which project-scoped MCP config it reads (Claude Code `.mcp.json`; Codex, Copilot CLI, pi and agy: check, with sources). Keep one source per repo: if harnesses need different files, derive them from `.mcp.json` rather than hand-maintaining copies. A harness that can't read project-scoped config gets a line in the repo's `AGENTS.md` naming the server, so a helper knows to ask for it. Also drop the stale entries in this repo's `.mcp.json` / `.claude/settings.local.json` (the Z.ai servers whose skills ticket 01 removed) if nothing uses them.

**Blocked by:** none.

**Status:** needs-triage

- [ ] A Codex helper started in each of the three repos lists `emdash-docs` among its MCP servers (output in a comment); the same for every other harness that supports project config, with sources for those that don't.
- [ ] Each repo has one source for the server definition.
- [ ] Briefs for EmDash work name the MCP as the docs route, not the website.

## Comments
