# Working on this monorepo

Read [README.md](README.md) for workspace layout, local development, seed media, checks, and plugin locations.

## Task context

Read the matching document before working on these areas:

- Drafting posts or handing off publication: [publishing](docs/publishing.md), including the token-owner preflight.
- Reaching `emdash-docs`, `emdash-staging-agent`, `emdash-site`, `emdash-garden`, or `cloudflare`: [MCP access](docs/mcp.md).
- CI/CD, deployment secrets wizard, production promotion, or migration lock recovery: [deploying](docs/deploying.md).
- Content routes, discovery endpoints, `/og/*`, or verified previews: [published-route rules](docs/published-routes.md) and [post descriptions](docs/posts-description.md). Preserve the anonymous published-only boundary.
- Dependencies or Astro/Vite configuration: [dependency overrides](docs/dependency-overrides.md) and [Astro 7 upgrade](docs/astro-7-upgrade.md).

Before using an EmDash API, hook, config option, field type, or pattern, verify it against live documentation from the repository root:

```bash
pnpm exec mcporter list emdash-docs --schema
pnpm exec mcporter call emdash-docs.search_docs query:"your question"
```

## Project skills

Load the matching skill from `.agents/skills/`:

- `building-emdash-site`: site features, content queries, Portable Text rendering, schema, seeds, menus, widgets, search, SEO, comments, and bylines.
- `creating-plugins`: plugin hooks, storage, admin UI, API routes, and Portable Text block types.
- `emdash-cli`: CLI content management, seeding, generated types, and visual editing.
- `emdash-mcp`: querying and preparing drafts through mcporter for human publication.

## Implementation rules

- Keep CMS content routes server-rendered (`output: "server"`); `getStaticPaths()` is incompatible with live CMS content.
- Image fields are `{ src, alt }` objects. Render them with `<Image image={...} />` from `"emdash/ui"`.
- `entry.id` is the URL slug; `entry.data.id` is the database ULID for calls such as `getEntryTerms`.
- Call `Astro.cache.set(cacheHint)` on every route that queries content.
- Match taxonomy queries to the seed’s exact `"name"`, such as `"category"` or `"tag"`.
- Preserve each app’s `src/live.config.ts` loader boilerplate unchanged. EmDash generates each app’s `emdash-env.d.ts` collection types.
- Keep telemetry disabled: `ASTRO_TELEMETRY_DISABLED=1` and `WRANGLER_SEND_METRICS=false`.
- User-visible copy belongs to James; obtain his wording for new or changed copy.
- Keep palette changes in `packages/ui/src/styles/`, with WCAG 2.2 AA contrast in light and dark modes. Display fonts are Instrument Serif on marketing-site and Familjen Grotesk on digital-garden.

## Marketing page builder

Pages use the `layout` field, rendered through `apps/marketing-site/src/components/page-builder/PageLayout.astro`; section components live alongside it. The legacy Portable Text `content` field is retired.

- `apps/marketing-site/src/components/page-builder/offered-blocks.json` owns offered definitions. Sync seed `blockTypes` and `allowedTypes` with `node apps/marketing-site/scripts/sync-page-builder-seed.mjs`; typecheck checks this with `--check`.
- Apply definitions with `pnpm --filter marketing-site page-builder`, which wraps `emdash-page-builder` and requires `EMDASH_TOKEN`.
- Shared-content blocks (testimonials, pricing, faqs, team) query matching collections scoped by the page’s optional `service` reference. Inline blocks (hero, cta, features, stats, comparison, prose) carry their own data.
- Block schema fields stay optional; the plugin’s publish policy enforces required fields on publish.
- Migrate legacy content and retire its field with `scripts/move-content-to-layout.mjs` and `scripts/retire-pages-content.mjs`: plan by default, `--apply` to write.
