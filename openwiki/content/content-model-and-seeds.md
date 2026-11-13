---
type: content model
title: Content model and seeds
description: The seed.json schema both apps share — eight collections, category/tag taxonomies, menus, bylines, the marketing layout block types, and the settings that feed site identity.
tags: [emdash, schema, seed, collections, taxonomies, content-model]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-e3b451ccfddf1fd7710c0f7e
    resource: repo://apps/digital-garden/seed/seed.json
  - id: openwiki-source-d6089a5bd59eb57767ea33fd
    resource: repo://apps/marketing-site/package.json
  - id: openwiki-source-36435ea19f01f785600f12a6
    resource: repo://apps/marketing-site/seed/seed.json
  - id: openwiki-source-b4b124a71e74ba72bfbe44ae
    resource: repo://docs/publishing.md
  - id: openwiki-source-e3c344c7562c010cce829a72
    resource: repo://packages/cms-helpers/src/site-identity.ts
  - id: openwiki-source-d6d6ab2589aefa6273a24626
    resource: repo://scripts/seed-local.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

<!-- openwiki: broken internal link [/openwiki/content/local-seeding.md] link "/openwiki/content/local-seeding.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Each app owns its content model in `seed/seed.json` (path declared in the app's `package.json` `emdash.seed` block). A seed carries `$schema`/`version`, `meta`, `settings`, `collections`, `taxonomies`, `bylines`, `menus`, `content`, and — on marketing only — `blockTypes`. EmDash applies seeds through `emdash seed`, which creates schema and content together (see [Local seeding workflows](/openwiki/content/local-seeding.md)). The schema in a seed describes development; live deployments may differ, and the drafting agent token cannot read schema, so deployed differences need an administrator.

## Collections

Both apps define the same eight collections; only marketing's `pages` carries the page-builder fields:

| Collection | Supports | Key fields |
| --- | --- | --- |
| `pages` | drafts, revisions, seo | `title`, `layout` (blocks, marketing only), `service` (reference → services) |
| `services` | drafts, revisions | `title`, `description` |
| `testimonials` | drafts, revisions | `quote`, `author`, `role`, `company`, `avatar`, `service` |
| `faqs` | drafts, revisions | `question`, `answer`, `service` |
| `pricing` | drafts, revisions | `name`, price fields, `features`, CTA, `badge`, `highlighted`, `service` |
| `team` | drafts, revisions | `name`, `role`, `image`, `service` |
| `posts` | drafts, revisions, search, seo | `title`, `featured_image`, `content` (Portable Text), `excerpt` — `commentsEnabled: true` on marketing |
| `projects` | drafts, revisions, search, seo | `title`, `featured_image`, `client`, `year`, `summary`, `content`, `gallery`, `url` |

<!-- openwiki: broken internal link [/openwiki/routing/published-route-boundary.md] link "/openwiki/routing/published-route-boundary.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [/openwiki/page-builder/shared-content-blocks.md] link "/openwiki/page-builder/shared-content-blocks.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Only `pages`, `posts`, and `projects` are public collections rendered by site routes ([Published-route boundary](/openwiki/routing/published-route-boundary.md)); `services`, `testimonials`, `faqs`, `pricing`, and `team` are shared-content pools that page-builder blocks query, scoped by a page's optional `service` reference ([Shared content blocks](/openwiki/page-builder/shared-content-blocks.md)).

<!-- openwiki: broken internal link [/openwiki/page-builder/block-registry.md] link "/openwiki/page-builder/block-registry.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Marketing's `pages.layout` is a `blocks` field whose validation `allowedTypes` lists exactly the eleven `blockTypes` the seed defines (`hero`, `cta`, `features`, `testimonials`, `pricing`, `comparison`, `team`, `faq`, `stats`, `prose`, `posts`); parity between the field's allowlist and the `blockTypes` definitions is enforced by `scripts/sync-page-builder-seed.mjs --check` in typecheck ([Page builder block registry](/openwiki/page-builder/block-registry.md)). The legacy Portable Text `content` field on pages is retired.

## Taxonomies, bylines, menus

- Two taxonomies — `category` and `tag`, both named exactly so — apply to `posts` and `projects`. Route and archive code matches these seed names literally.
- Bylines attach author credits; marketing seeds one (`byline-james`), the garden keeps its two template bylines. Posts carry `taxonomies` (`{category: [...]}`) and `bylines` (`{byline: <id>}`) maps in seed content.
- Five menus: `primary` plus four footer groups (`footer_product`, `footer_company`, `footer_resources`, `footer_legal`).

## Site identity and seed content

`settings.title` and `settings.tagline` are the source of site identity: layouts and metadata resolve them through `resolveSiteIdentity` with the route's URL, so both apps' shared chrome adapts without config forks. Marketing seeds `"James Ryan"` / `"AI-native marketer & engineer"`; the garden seeds a notes-oriented tagline.

Seed `content` entries carry `id` (which becomes the entry slug/URL), `slug`, `status`, `publishedAt` where relevant, and `data`. Marketing seeds 4 pages and 6 published posts with real Portable Text bodies; its shared-content pools are empty by default. The garden seed is the unchanged upstream template seed (4 pages, 6 testimonials, 8 team members, 3 pricing plans, services/faqs/posts/projects samples).

Media inside seeds uses EmDash 1.5's native `$media.file` objects — `{ $media: { file: "assets/..." } }` with paths relative to `seed.json`. Marketing's images are committed under `apps/marketing-site/seed/assets/`; alt text and captions belong to each reference, and the seeder reuses EmDash's upload, dimensions, and hash deduplication while rejecting absolute paths, parent escapes, and symlink tricks.
