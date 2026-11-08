# 03-8b1e2850: Merge Code Block Pro copy back upstream and bring it to EmDash 1.4

**Spec:** docs/specs/baseline.md

**What to build:**

Work in `../emdash-plugin-code-block-pro` (its own repo). Bring over what the copy in this repo has that upstream lacks (Plain Text and Mermaid in `src/constants.ts` and `src/astro/CodeBlockPro.astro`; diff the whole of `src/` and `docs/`). Bring the plugin to EmDash 1.4's native descriptor and `componentsEntry` (check with the EmDash docs MCP). Update the peer range to `^1.4.0`. Tests pass, lint passes. Prepare a release and stop: James approves the first `npm publish`.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] `diff -r` of `src/` between the copy and upstream shows only intentional 1.4 changes.
- [ ] Tests and lint pass in the plugin repo's CI.
- [ ] A release PR is ready, with the version bumped and the README stating it is a **native** plugin and why.
- [ ] Status set to `needs James` for the publish approval.

## Comments
