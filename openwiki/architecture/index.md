# Files

- [Cloudflare and EmDash runtime](cloudflare-emdash-runtime.md) - How both Astro apps run as Cloudflare Workers with EmDash on D1, R2, KV, and the Worker Loader sandbox, including per-environment bindings and the runtime migration-check policy.
- [Monorepo layout and package boundaries](monorepo-layout.md) - The pnpm workspace behind both sites — which package owns the config factory, content helpers, and UI, what each app adds, and the supply-chain policy that governs dependencies.
- [Site config factory](site-config-factory.md) - createSiteConfig in packages/astro-config centralizes every Astro, Cloudflare, and EmDash config decision, leaving each app to pass only its deployment differences.
