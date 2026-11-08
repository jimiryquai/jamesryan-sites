# 03-8b1e2850: Merge Code Block Pro copy back upstream and bring it to EmDash 1.4

**Spec:** docs/specs/baseline.md

**What to build:**

Work in `../emdash-plugin-code-block-pro` (its own repo). Bring over what the copy in this repo has that upstream lacks (Plain Text and Mermaid in `src/constants.ts` and `src/astro/CodeBlockPro.astro`; diff the whole of `src/` and `docs/`). Bring the plugin to EmDash 1.4's native descriptor and `componentsEntry` (check with the EmDash docs MCP). Update the peer range to `^1.4.0`. Tests pass, lint passes. Prepare a release and stop: James approves the first `npm publish`.

**Blocked by:** none.

**Status:** done

- [x] `diff -r` of `src/` between the copy and upstream shows only intentional 1.4 changes.
- [x] Tests and lint pass in the plugin repo's CI.
- [x] A release PR is ready, with the version bumped and the README stating it is a **native** plugin and why.
- [x] Status set to `needs James` for the publish approval.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: high (no docs/agents/review.md; release PR in another repo leading to a public npm publish, beyond this repo).

**2026-11-08 Claude (orchestrator):** Built by h03-codex (Codex, GPT-6.1 Sol) in `../emdash-plugin-code-block-pro`, branch `03-code-block-pro-1-4`, commits e5261c1 and 853f283; release PR jimiryquai/emdash-plugin-code-block-pro#5 (0.2.0, peer `emdash ^1.4.0`). Plain Text, Mermaid, the foreground fixes and the scrollbar styles came over from the copy; `src/constants.ts` and `src/astro/CodeBlockPro.astro` now match it exactly, and the remaining `src/` differences are the 1.4 descriptor and runtime plus their tests. The plugin stays native and the README says why. Orchestrator re-ran `npm ci --legacy-peer-deps`, `npx tsc --noEmit`, `npx eslint src/` and `npx vitest run` (60 passed); PR checks green on 853f283. Cross-family review (Anthropic over OpenAI) found three first-publish defects the helper's own reviews missed, fixed in round 1: no LICENSE file or `license` field though the README said MIT; no `repository` field, which `npm publish --provenance` needs; a README preview image that 404'd (now `docs/assets/preview.png`, rendered from the component). Not merged and not published: James merges the PR and publishes the release. Evidence: `.orchestrate/runs/2026-11-08-03-code-block-pro-1-4/` once archived.

**2026-11-08 Claude (orchestrator):** Published. The `v0.2.0` release's CI publish failed (`E404 PUT`): Node 22 bundles npm 10, and trusted publishing needs npm 11.5.1 or later, so npm never attempted OIDC. PR #6 installs npm 11.21.1 in `publish.yml`. Being the package's first publish, James published 0.2.0 by hand from a clean clone of the `v0.2.0` tag and added the trusted publisher (`npm trust github … --file publish.yml --allow-publish`), so later releases publish from CI. npm: `latest` = 0.2.0 (13:58:30Z). A `0.0.0-stage` placeholder version (13:56:53Z) was created before it, most likely by `npm trust` on a package that didn't exist yet. Worktrees and branches tidied.
