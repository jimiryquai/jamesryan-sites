---
module: emdash-plugin
problem_type: testing
tags: ["emdash","vitest","testing","astro"]
---
### [2026-05-22] Plugin test files that import .astro components need astro as devDependency
When an EmDash plugin's vitest config uses plain `defineConfig` from vitest (not `getViteConfig` from `astro/config`), test files that transitively import `.astro` files will fail at parse time with "invalid JS syntax". This masks stale assertions in those test files. When switching vitest config to plain `defineConfig` to enable descriptor tests (which don't need Astro), either exclude the `.astro`-importing test files or add `astro` as a devDependency. Always update related test files when removing exports from `index.ts` — don't leave tests asserting removed properties.
