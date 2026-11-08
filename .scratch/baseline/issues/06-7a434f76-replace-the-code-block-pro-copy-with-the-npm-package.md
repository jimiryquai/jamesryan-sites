# 06-7a434f76: Replace the Code Block Pro copy with the npm package

**Spec:** docs/specs/baseline.md

**What to build:**

Once Code Block Pro is published, add `emdash-plugin-code-block-pro` from npm to both apps, delete `packages/emdash-plugin-code-block-pro`, and remove the `fs.allow` reach-up to `../../../` in `astro.config.mjs` if nothing else needs it.

**Blocked by:** 03-8b1e2850, 05-10cd2eae.

**Status:** ready-for-agent

- [ ] `packages/` no longer contains the plugin; both apps resolve it from npm.
- [ ] Existing code blocks and Mermaid diagrams render identically (screenshot before and after).
- [ ] CI green.

## Comments
