# 06-7a434f76: Replace the Code Block Pro copy with the npm package

**Spec:** docs/specs/baseline.md

**What to build:**

Once Code Block Pro is published, add `emdash-plugin-code-block-pro` from npm to both apps, delete `packages/emdash-plugin-code-block-pro`, and remove the `fs.allow` reach-up to `../../../` in `astro.config.mjs` if nothing else needs it.

**Blocked by:** 03-8b1e2850, 05-10cd2eae.

**Status:** done

- [x] `packages/` no longer contains the plugin; both apps resolve it from npm.
- [x] Existing code blocks and Mermaid diagrams render identically (screenshot before and after).
- [x] CI green.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: medium (no docs/agents/review.md; swaps a dependency and deletes the workspace copy; no runtime config beyond the apps).

Replaced the workspace copy with `emdash-plugin-code-block-pro@0.2.0` in both apps and removed the Vite filesystem reach-up. Added the package's Shiki peers and a version-specific release-age exception because 0.2.0 was published today.

Local JavaScript and Mermaid post fixtures in both apps produced four pixel-identical before/after screenshots. Frozen install, typecheck and build passed; `pnpm test` exited successfully but no remaining workspace has a test script. PR: #11, commit 5e7e830. pnpm warns that the plugin declares React 18 peers while the apps use React 19.

**2026-11-08 Claude (orchestrator):** Done. Built by h06-copilot (Copilot, GPT-6.1 Terra), PR #11 (5e7e830) merged into `baseline`; lockfile re-resolved on top of 16. Both apps pin `emdash-plugin-code-block-pro` 0.2.0 from npm (with Shiki 4.1.0 peers); `packages/emdash-plugin-code-block-pro` and the `vite.server.fs` reach-up are gone; a release-age exception covers exactly `emdash-plugin-code-block-pro@0.2.0`. Before/after Chrome screenshots of a JavaScript and a Mermaid-source block in each app: 0 pixel differences (orchestrator viewed the renders). Merged-tree checks pass. For the plugin's next release: its React peer is `^18` while both apps use React 19 (pnpm warns; rendering is fine), so widen it to `^18 || ^19`, alongside James's decision on the "Mermaid Diagram" label. `pnpm test` runs no tests until 07's `scripts/*.test.mjs` merge. Evidence: `.orchestrate/runs/2026-11-08-06-npm-code-block-pro/`.
