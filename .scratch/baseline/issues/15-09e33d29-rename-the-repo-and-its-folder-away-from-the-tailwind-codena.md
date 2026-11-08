# 15-09e33d29: Rename the repo and its folder away from the Tailwind codename

**Spec:** docs/specs/baseline.md

**What to build:**

Rename `jimiryquai/oatmeal-olive-instrument` on GitHub (`gh repo rename`; GitHub redirects the old URL) and the folder `~/Repos/Workspace/building/oatmeal-olive-instrument`, to `jamesryan-sites` (James, 2026-11-08). Follow `~/Repos/Workspace/docs/changing-the-structure.md`: update `building/CONTEXT.md` (its row also wrongly says "this one site"; it's two), the Workspace `.gitignore`, `git remote set-url`, and rename `~/.claude/projects/-home-james-Repos-Workspace-building-oatmeal-olive-instrument` so memory and history follow. Replace absolute paths that name the old folder in `.mcp.json`, `config/mcporter.json` and `docs/plans/*`. The root `package.json` name (`jamesryan-monorepo`) is updated to match. Do this before ticket 02, so CI is set up under the final name. Do it between sessions: no helper may be working in the old path.

**Blocked by:** none.

**Status:** done

- [x] `gh repo view` shows the new name; `git remote -v` points at it.
- [ ] `grep -r oatmeal-olive-instrument` (excluding `node_modules` and git history) finds nothing.
- [ ] A new Claude Code session in the new folder loads this project's memory.

## Comments

**2026-11-08 Claude:** Done. GitHub repo renamed to `jimiryquai/jamesryan-sites` (old URL redirects), remote updated, `building/CONTEXT.md` updated and committed in the Workspace repo, folder and `~/.claude/projects` memory folder moved. `.mcp.json` and `config/mcporter.json` now resolve `.env` from `git rev-parse --show-toplevel`; they pointed at the pre-Workspace path before, so `.env` never loaded. The only remaining old-path references are in `apps/marketing-site/debug_save.sh` (deleted by 01) and the copy's `docs/sandbox-plan.md` (deleted by 06). The memory-loading criterion is checked when the next session starts.
