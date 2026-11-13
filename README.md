# James Ryan’s sites

A pnpm monorepo for James Ryan’s site and blog and his digital garden, built with Astro, EmDash 1.5, and Cloudflare Workers (D1, R2, KV, and the Worker Loader sandbox).

## Workspace

| App | Purpose | Production domain | Staging | Local |
| --- | --- | --- | --- | --- |
| `apps/marketing-site` | James Ryan’s site and blog | https://jamesryan.dev | https://staging.jamesryan.dev | http://localhost:4321 |
| `apps/digital-garden` | Digital garden | https://jamesryan.me | https://staging.jamesryan.me | http://localhost:4322 |

The garden is upgraded and deployed to **staging only**. Production promotion has not happened; its content model is a separate project.

| Shared package | Location | Owns |
| --- | --- | --- |
| `@jamesryan/astro-config` | `packages/astro-config` | `createSiteConfig`, the shared Astro/Cloudflare/EmDash config factory, and the Worker entrypoint’s `PluginBridge` export |
| `@jamesryan/cms-helpers` | `packages/cms-helpers` | Published-route gating, URL mapping, `/og/*` image generation, `llms.txt`, and the `/s1/*` Usermaven proxy |
| `@jamesryan/ui` | `packages/ui` | Shared WCAG 2.2 AA olive palette (`tailwind.css` and `tokens.css`) and Astro UI primitives |

Each app owns its `astro.config.mjs`, `seed/seed.json` schema and content, and `src/pages/` routes. Site settings `title` and `tagline` supply the shared layout’s site identity and metadata.

## Local development and checks

Use Node.js 24 or newer (required by mcporter) and the pnpm version in `package.json`. Run commands from the repository root:

```bash
export ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false
pnpm install
pnpm dev          # marketing-site on :4321
pnpm dev:garden   # digital-garden on :4322
pnpm dev:all      # both apps
```

Run checks with:

```bash
pnpm typecheck
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test
```

To record theme selection, persistence, keyboard controls, and mobile layout against an already running, locally seeded marketing Worker:

```bash
node scripts/check-theme.mjs http://127.0.0.1:14321 .scratch/theme
```

### Local admin and authentication

| App | Admin | Development auth bypass |
| --- | --- | --- |
| Marketing | [Open admin](http://localhost:4321/_emdash/admin) | [Recover local access](http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin) |
| Garden | [Open admin](http://localhost:4322/_emdash/admin) | [Recover local access](http://localhost:4322/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin) |

The bypass restores access when local passkeys are lost or invalidated.

### Marketing seed media

Marketing content uses committed files in `apps/marketing-site/seed/assets/`. Keep `$media.file` paths relative to `apps/marketing-site/seed/seed.json`; alt text and captions belong to each reference. The garden seed is unchanged.

For a fresh development database, run `pnpm build`, `pnpm seed:local`, then `pnpm dev` **before opening setup or dev-bypass**. Workers cannot read seed assets from the Node filesystem. The seed command populates the marketing app’s actual `.wrangler/state` D1 database and R2 bucket, returns their paths and media rows as JSON, and can be rerun without replacing existing content.

After building, run `bash scripts/check-rendered-seo.sh --real-seed` to apply the complete marketing seed to fresh, isolated local D1/R2 storage and check the built Worker. Set `RENDERED_EVIDENCE_DIR` to an absolute directory to save media rows and home/post screenshots. Screenshots require the Playwright Chromium installation above; CI checks images over HTTP without a browser.

To repair a new export, read the source site’s `media` table using Wrangler’s `d1 execute ... --remote --command 'SELECT * FROM media' --json`, save the output, then run:

```bash
node scripts/seed-media.mjs apps/marketing-site/seed/seed.json media-rows.json https://staging.jamesryan.dev
```

This downloads images and writes local assets and the seed using media storage keys. It preserves content alt text and captions, rejects filename collisions, and verifies files on reruns. Review and commit both JSON and assets.

EmDash 1.5’s native `$media.file` support and programmatic `mediaBasePath` reuse upload, dimensions, and hash deduplication. Absolute paths and escapes through parent paths or symlinks are rejected; `scripts/seed-local.test.mjs` checks the real CLI behavior. Seed with the Node CLI before serving local R2 media; local files are not bundled into Workers.

## Deployment and publishing

PR CI runs typecheck, build, and tests. Merges to `master` deploy both staging sites and run smoke, SEO, and axe checks. Production uses manual `workflow_dispatch` with `promote`, for jamesryan.dev only. Read [deploying](docs/deploying.md) for the workflow, secrets setup, promotion, and migration recovery.

Agents draft through Contributor-scoped MCP access; James reviews and publishes in the EmDash admin. Read [publishing](docs/publishing.md) for the token preflight and handoff, and [MCP access](docs/mcp.md) for server connections.

## Plugins

All plugins are installed from npm; their source lives outside this repository, with no in-repo copies. Sibling paths below are relative to the main checkout.

| npm package | Runtime and use | Source |
| --- | --- | --- |
| `emdash-plugin-code-block-pro` | Native/in-process on both apps; Portable Text rendering components require a native plugin | [jimiryquai/emdash-plugin-code-block-pro](https://github.com/jimiryquai/emdash-plugin-code-block-pro); sibling `../emdash-plugin-code-block-pro` |
| `emdash-plugin-page-builder` | Native/in-process on marketing-site; modular `layout` blocks | [jimiryquai/emdash-plugin-page-builder](https://github.com/jimiryquai/emdash-plugin-page-builder); sibling `../emdash-plugin-page-builder` |
| `emdash-plugin-ai-comment-moderation` | Sandboxed on marketing-site under `sandboxed: []`, via `@emdash-cms/cloudflare` Worker Loader | [jimiryquai/emdash-plugin-ai-comment-moderation](https://github.com/jimiryquai/emdash-plugin-ai-comment-moderation); sibling `../emdash-plugin-ai-comment-moderation` |
| `@jdevalk/emdash-plugin-seo` | Third-party native SEO plugin on both apps, paired with `@jdevalk/astro-seo-graph` validators | npm package maintained upstream |
