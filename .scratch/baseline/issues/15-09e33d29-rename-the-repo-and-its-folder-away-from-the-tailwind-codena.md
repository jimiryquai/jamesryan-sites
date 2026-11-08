# 15-09e33d29: Rename the repo and its folder away from the Tailwind codename

**Spec:** docs/specs/baseline.md

**What to build:**

Rename `jimiryquai/oatmeal-olive-instrument` on GitHub (`gh repo rename`; GitHub redirects the old URL) and the folder `~/Repos/Workspace/building/oatmeal-olive-instrument`, to `jamesryan-sites` (James, 2026-11-08). Follow `~/Repos/Workspace/docs/changing-the-structure.md`: update `building/CONTEXT.md` (its row also wrongly says "this one site"; it's two), the Workspace `.gitignore`, `git remote set-url`, and rename `~/.claude/projects/-home-james-Repos-Workspace-building-oatmeal-olive-instrument` so memory and history follow. Replace absolute paths that name the old folder in `.mcp.json`, `config/mcporter.json` and `docs/plans/*`. The root `package.json` name (`jamesryan-monorepo`) is updated to match. Do this before ticket 02, so CI is set up under the final name. Do it between sessions: no helper may be working in the old path.

**Blocked by:** none.

**Status:** ready-for-agent (run between sessions)

- [ ] `gh repo view` shows the new name; `git remote -v` points at it.
- [ ] `grep -r oatmeal-olive-instrument` (excluding `node_modules` and git history) finds nothing.
- [ ] A new Claude Code session in the new folder loads this project's memory.

## Comments
