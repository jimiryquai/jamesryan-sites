# Proposal: Unified EmDash Plugin Sandbox Tooling

This document outlines a plan to decouple and standardize the local development sandbox environment for EmDash plugins. The goal is to move from local boilerplate configurations to a reusable, one-command CLI utility (or monorepo scaffolding script) so any developer can instantly test their plugins.

---

## 1. Background & Problem Statement

Currently, testing an EmDash plugin in isolation requires manual orchestration:
1. Creating a root `astro.config.mjs` and configuring a SQLite adapter.
2. Setting up `@astrojs/node` to support session cookies/credentials.
3. Defining a `src/live.config.ts` to register dynamic content collections (`_emdash`).
4. Scaffolding fallback routes like `src/pages/index.astro` and `src/pages/posts/[slug].astro` to support previewing.

While functional, this boilerplate bloats the plugin's source repository and must be excluded from the published NPM package. It also introduces potential configuration drift and port conflicts across multiple plugins.

---

## 2. Proposed Architecture: `emdash sandbox` CLI

Instead of local boilerplate, the EmDash core CLI should provide a native sandbox runner. 

```bash
# Initialize database and seed content
npx emdash sandbox init -d ./sandbox.db

# Run the dev server automatically registering a plugin
npx emdash sandbox dev --plugin ./src/index.ts --admin ./src/admin.tsx
```

### Key Behaviors of the CLI Runner:
1. **Dynamic Workspace Generation:**
   The CLI creates a temporary Astro environment inside a `.emdash/sandbox/` cache directory (git-ignored).
2. **Auto-Generated Configs:**
   It generates the virtual `astro.config.mjs` and `live.config.ts` on the fly, referencing the specified database file and plugin entrypoints.
3. **Standard Sandbox Pages:**
   The CLI mounts a pre-built CMS admin dashboard and standard preview routes (like `/posts/[slug]`) automatically, resolving common templates out-of-the-box.
4. **Built-in Session & WebAuthn Management:**
   It configures the Node adapter, default filesystem sessions, and Relying Party IDs automatically for the local port, preventing redirect loops.

---

## 3. Alternative: Monorepo Scaffolding Script

If core CLI changes to `emdash` are deferred, we can implement a workspace-level generator script inside this monorepo (`oatmeal-olive-instrument`) to automate the setup for new plugins:

* **Location:** `scripts/scaffold-sandbox.js`
* **Behavior:** When run in a workspace package (e.g. `packages/emdash-plugin-foo`), it writes the standard minimal template files:
  * `astro.config.mjs`
  * `src/live.config.ts`
  * `src/pages/index.astro`
  * `src/pages/posts/[slug].astro`
* It adds standard devScripts (`sandbox:init`, `sandbox:dev`) and dependencies (`@astrojs/node`) to the target `package.json`.

---

## 4. Next Steps & Implementation Tasks

- [ ] Draft a prototype of the monorepo `scaffold-sandbox.js` script.
- [ ] Implement `.npmignore` or `files` array configurations in all plugins to ensure local sandbox files are never published to NPM.
- [ ] Submit a feature request / RFC to the EmDash core repository to support native sandbox orchestration.
