# 01-39b13245: Clear template and tooling leftovers

**Spec:** docs/specs/baseline.md

**What to build:**

Delete `apps/marketing-site/lighthouse-report*.report.{html,json}`, `apps/marketing-site/debug_save.sh`, the root `package-lock.json`, and `packages/emdash-plugin-code-block-pro/{package-lock.json,sandbox.db}` from git. pnpm is the only package manager. Remove the `.agents/skills` entries `web-reader-mcp`, `web-search-mcp`, `zread-mcp`, `zai-vision-mcp` and the `agent-browser` symlink (machine tooling, not project knowledge). Move `docs/plans/*` to `docs/plans/archive/` with a one-line note on each saying whether it shipped. Add `*.report.html`/`*.report.json` and `sandbox.db` to `.gitignore`.

**Blocked by:** none.

**Status:** done

- [x] None of the listed files are tracked (`git ls-files` proves it).
- [x] `.agents/skills` holds only EmDash skills and `emdash-mcp`.
- [x] `pnpm install --frozen-lockfile` still succeeds.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: medium (no docs/agents/review.md, default tier; deletes tracked files and edits .gitignore only).

**2026-11-08 Claude (orchestrator):** Done in 234855d, merged to `baseline` in 0b34295. Worked by the orchestrator directly, because helpers can't launch on Linux yet (agent-workflow 22-55e812ec). `git ls-files` lists none of the removed files; `.agents/skills` holds `building-emdash-site`, `creating-plugins`, `emdash-cli` and `emdash-mcp`; `pnpm install --frozen-lockfile` passes on the merged tree. Plans moved to `docs/plans/archive/`, each with a shipped / not shipped / unknown note, and their relative links fixed. The untracked Lighthouse reports were deleted from the main checkout and are now ignored. Evidence: `.orchestrate/runs/2026-11-08-01-clear-leftovers/`.
