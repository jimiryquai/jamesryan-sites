# 36-aff31a4e: Align emdash-mcp skill with mcporter config and human-publishing rules

**Spec:** docs/specs/baseline.md

**What to build:**

`.agents/skills/emdash-mcp/SKILL.md` is out of date with the repository's MCP architecture (`docs/mcp.md`, ticket `22-032faafb`) and human-publishing boundary (`docs/publishing.md`, ticket `12-c648eac4`):

1. `.agents/skills/emdash-mcp/SKILL.md:9` names the marketing MCP server `emdash-marketing`, whereas `docs/mcp.md:5` defines `emdash-site` (and `emdash-staging-agent` for staging).
2. `.agents/skills/emdash-mcp/SKILL.md:12` instructs agents: `"The tools are exposed natively to your environment. Do not run shell commands (npx mcporter) to call them."` Since ticket `22-032faafb` removed site MCP servers from `.mcp.json` so sessions start cleanly without a running dev server, agents reach `emdash-site`, `emdash-garden`, and `emdash-staging-agent` on request via `mcporter` (`docs/mcp.md:10-35`).
3. `.agents/skills/emdash-mcp/SKILL.md:3,23,25,26,29-31,38,41` tells agents they can `publish, or delete posts, pages` (contradicting the draft-only agent / human-publishes workflow in `docs/publishing.md`), uses retired `"content": []` on `pages` (`line 25`, now `layout`), `/blog` instead of `/posts` (`line 38`), and `post_tag` instead of `tag` (`line 41`, violating `AGENTS.md:54`).

Rewrite `.agents/skills/emdash-mcp/SKILL.md` so it delegates server discovery and invocation to `docs/mcp.md` and drafting/handoff rules to `docs/publishing.md` without duplicating or contradicting them, and uses current collection/route/taxonomy names (`layout`, `/posts`, `tag`).

**Blocked by:** none.

**Status:** in progress

- [ ] `.agents/skills/emdash-mcp/SKILL.md` references `emdash-site`, `emdash-garden`, and `emdash-staging-agent` via `docs/mcp.md` and `docs/publishing.md` rather than forbidding `mcporter` or naming `emdash-marketing`.
- [ ] All examples in `.agents/skills/emdash-mcp/SKILL.md` respect the draft-only publishing boundary (no `status: "published"` writes or `content_delete` instructions for published content) and use current schema/taxonomy/route names (`layout`, `category`, `tag`, `/posts`).

## Comments

**2026-11-12 Gemini (agy Carbon, orchestrator):** Promoted to `baseline` and claiming for `h36-grok` (`grok-4.7`, branch `36-emdash-mcp-skill`). Risk: medium (reversible doc/skill PR to `master`).
