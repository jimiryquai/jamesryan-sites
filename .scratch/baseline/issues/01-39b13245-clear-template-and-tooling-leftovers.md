# 01-39b13245: Clear template and tooling leftovers

**Spec:** docs/specs/baseline.md

**What to build:**

Delete `apps/marketing-site/lighthouse-report*.report.{html,json}`, `apps/marketing-site/debug_save.sh`, the root `package-lock.json`, and `packages/emdash-plugin-code-block-pro/{package-lock.json,sandbox.db}` from git. pnpm is the only package manager. Remove the `.agents/skills` entries `web-reader-mcp`, `web-search-mcp`, `zread-mcp`, `zai-vision-mcp` and the `agent-browser` symlink (machine tooling, not project knowledge). Move `docs/plans/*` to `docs/plans/archive/` with a one-line note on each saying whether it shipped. Add `*.report.html`/`*.report.json` and `sandbox.db` to `.gitignore`.

**Blocked by:** none.

**Status:** in progress

- [ ] None of the listed files are tracked (`git ls-files` proves it).
- [ ] `.agents/skills` holds only EmDash skills and `emdash-mcp`.
- [ ] `pnpm install --frozen-lockfile` still succeeds.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: medium (no docs/agents/review.md, default tier; deletes tracked files and edits .gitignore only).
