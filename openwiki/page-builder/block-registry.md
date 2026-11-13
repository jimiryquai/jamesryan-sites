---
type: feature architecture
title: Page builder block registry
description: How marketing pages are composed — offered-blocks.json as the single source of block selection, the blocks.ts section adapter contract, PageLayout rendering, and the seed/CLI syncing that keeps definitions, schema, and sections in parity.
tags: [page-builder, emdash-plugin, blocks, marketing-site, astro-components]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-d6089a5bd59eb57767ea33fd
    resource: repo://apps/marketing-site/package.json
  - id: openwiki-source-6e279ccdf30fd4d33a7a3cec
    resource: repo://apps/marketing-site/scripts/apply-page-builder.mjs
  - id: openwiki-source-5cad947450bd9dcf3b8bc24f
    resource: repo://apps/marketing-site/scripts/sync-page-builder-seed.mjs
  - id: openwiki-source-c1078e99df54597ecb75e97a
    resource: repo://apps/marketing-site/src/components/page-builder/blocks.ts
  - id: openwiki-source-6c0ed2416bf4bd1718b9747a
    resource: repo://apps/marketing-site/src/components/page-builder/offered-blocks.json
  - id: openwiki-source-8a470e29ba5efe3ca80fe6dc
    resource: repo://apps/marketing-site/src/components/page-builder/offered-blocks.mjs
  - id: openwiki-source-047bab92e4c5713176f658e3
    resource: repo://apps/marketing-site/src/components/page-builder/resolve-page-layout.ts
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

Marketing pages are composed from `emdash-plugin-page-builder` blocks stored in the pages collection's `layout` field (Portable Text `content` on pages is retired). Three artifacts must agree, and the repo enforces that agreement mechanically.

## The single source: `offered-blocks.json`

`apps/marketing-site/src/components/page-builder/offered-blocks.json` is a plain array of the eleven offered block slugs — `hero`, `cta`, `features`, `testimonials`, `pricing`, `comparison`, `team`, `faq`, `stats`, `prose`, `posts`. `offered-blocks.mjs`'s `getOfferedBlocks()` imports it with a JSON import attribute, validates it is a non-empty duplicate-free list, and resolves each slug against the installed package's `BlockType` exports (anything shaped `{ definition, variants, migrations }`), throwing when a listed slug is not exported. Newly exported package blocks are therefore never offered implicitly — opting in is a one-line JSON edit.

## Section adapters: `blocks.ts`

The plugin renders blocks through sections the site supplies. `blocks.ts` maps each offered slug to an Astro section component: `hero`→`Hero.astro`, …, with `posts` as the one block whose **variants are distinct sections** (`default`/`featured-grid`→`PostsFeaturedGrid`, `grid`→`PostsGrid`, `list`→`PostsList`); every other block selects variants inside its single section. At module load it cross-checks both directions — a section with no offered slug or an offered slug with no section throws — so drift fails the build immediately. `withSections(block, section)` attaches each site section to its package block, materializing a per-variant map (still naming a `default`) when a single function covers all variants.

## Rendering: `PageLayout.astro`

<!-- openwiki: broken internal link [/openwiki/page-builder/shared-content-blocks.md] link "/openwiki/page-builder/shared-content-blocks.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
`PublishedPage.astro` calls `resolvePageLayout(page)`, a pure read of the entry the route already fetched through `getPublishedRoute` with `references: { service: true }`: it returns the `layout` blocks plus the page's service group key (`references.service.entries[0].data.id`) when present, with the route's single cache hint covering the read. `<PageLayout value group edit>` casts the generated block interfaces to the plugin's `StoredBlock[]` and delegates to the plugin's `PageBuilder.astro` with the site's `blocks` and `sources` (see [Shared content blocks](/openwiki/page-builder/shared-content-blocks.md)). `edit` passes EmDash's per-field edit bindings through so visual editing works on published pages.

## Keeping definitions, schema, and Workers in sync

- **Seed parity** — `scripts/sync-page-builder-seed.mjs` rewrites the seed's `blockTypes` from `getOfferedBlocks()` definitions and refreshes the pages `layout` field's `allowedTypes` to the same slugs; `--check` (wired into marketing's `typecheck`) fails when the committed seed differs, with the fix being a plain run of the script. The package owns definitions; the seed copy bootstraps fresh databases.
- **Applying to a live CMS** — `pnpm --filter marketing-site page-builder` runs `scripts/apply-page-builder.mjs`, which invokes the package's `emdash-page-builder` CLI (`apply`) with `--types` derived from the same `getOfferedBlocks()` selection — passing `--types` manually is rejected — and requires `EMDASH_TOKEN`. The renderer, seed, and CLI therefore always apply the identical block selection.

Block schema fields stay optional in the definitions; the plugin's publish policy enforces required fields at publish time rather than in the schema.
