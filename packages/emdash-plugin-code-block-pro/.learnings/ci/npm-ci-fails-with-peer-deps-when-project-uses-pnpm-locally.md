---
module: ci
problem_type: best_practice
tags: ["npm","pnpm","peer-deps","github-actions"]
---
### [2026-05-22] npm CI fails with peer deps when project uses pnpm locally
When a project uses pnpm locally (with `autoInstallPeers: true` in pnpm-lock.yaml) but GitHub Actions uses npm, peer dependencies will NOT be auto-installed. npm never auto-installs peer deps — even with `--legacy-peer-deps` (which only suppresses conflicts, not installs peers).

**Solution**: Dual-list peer deps as both `peerDependencies` (for consumers) and `devDependencies` (for CI/development). Also add any transitive peer deps that your tests/type-checking need (e.g., `react-dom`, `astro`, `@astrojs/react` when `emdash` peers on them).

**Also**: Tools needed by CI workflows (eslint, typescript, @eslint/js, typescript-eslint) must be in `devDependencies` — don't rely on ad-hoc `npm install` in workflow steps.

For astro component tests, use `getViteConfig` from `astro/config` in vitest.config.ts instead of plain `defineConfig` from vitest.
