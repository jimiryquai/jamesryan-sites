This is an EmDash site -- a CMS built on Astro with a full admin UI.

## Commands

```bash
npx emdash dev        # Start dev server (runs migrations, seeds, generates types)
npx emdash types      # Regenerate TypeScript types from schema
```

The admin UI is at `http://localhost:4321/_emdash/admin`.

## Key Files

| File                     | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `astro.config.mjs`       | Astro config with `emdash()` integration, database, and storage                    |
| `src/live.config.ts`     | EmDash loader registration (boilerplate -- don't modify)                           |
| `seed/seed.json`         | Schema definition + demo content (collections, fields, taxonomies, menus, widgets) |
| `emdash-env.d.ts`        | Generated types for collections (auto-regenerated on dev server start)             |
| `src/layouts/Base.astro` | Base layout with EmDash wiring (menus, search, page contributions)                 |
| `src/pages/`             | Astro pages -- all server-rendered                                                 |

## Skills

Agent skills are in `.agents/skills/`. Load them when working on specific tasks:

- **building-emdash-site** -- Querying content, rendering Portable Text, schema design, seed files, site features (menus, widgets, search, SEO, comments, bylines). Start here.
- **creating-plugins** -- Building EmDash plugins with hooks, storage, admin UI, API routes, and Portable Text block types.
- **emdash-cli** -- CLI commands for content management, seeding, type generation, and visual editing flow.

## Documentation

For drafting posts and the human publishing handoff, read `docs/publishing.md`.

For reaching the site MCP servers (`emdash-site`, `emdash-garden`,
`emdash-staging-agent`) on local dev or staging, read `docs/mcp.md`.

For EmDash documentation, run `pnpm exec mcporter list emdash-docs` and
`pnpm exec mcporter call emdash-docs.search_docs query:"your question"` from
the repository root, rather than browsing the website. `config/mcporter.json`
is the server source; `.mcp.json` links to it for Claude Code. mcporter
0.17.0 requires Node.js 24 or newer.

The EmDash docs are available as an MCP server at `https://docs.emdashcms.com/mcp`. When you need to verify an API, hook, config option, field type, or pattern, call `search_docs` against the live documentation rather than relying on training-data recall. The docs reflect current behaviour; assumptions may not.

This template ships with `.mcp.json`, `.cursor/mcp.json`, and `.vscode/mcp.json` so Claude Code, Cursor, and VS Code auto-discover the docs server. Other tools (OpenCode, Windsurf, etc.) need a manual one-time setup -- see [docs.emdashcms.com/docs-mcp](https://docs.emdashcms.com/docs-mcp).

## Rules

- All content pages must be server-rendered (`output: "server"`). No `getStaticPaths()` for CMS content.
- Image fields are objects (`{ src, alt }`), not strings. Use `<Image image={...} />` from `"emdash/ui"`.
- `entry.id` is the slug (for URLs). `entry.data.id` is the database ULID (for API calls like `getEntryTerms`).
- Always call `Astro.cache.set(cacheHint)` on pages that query content.
- Taxonomy names in queries must match the seed's `"name"` field exactly (e.g., `"category"` not `"categories"`).

## This Template

A SaaS-style landing page template with modular content blocks: hero, features, testimonials, pricing and FAQ. Designed for product marketing sites, app landing pages, and anything that needs a hero + features + pricing + CTA flow.

Bolder than the blog and portfolio templates: vibrant gradient accents, isometric illustration in the hero, heavy headline weights. The voice is product-confident without tipping into stock SaaS cliche.

## Pages

| Page | Path | What it shows |
| --- | --- | --- |
| Home | `/` | Published Home content and recent posts |
| About | `/about` | About layout, available only with a published About entry |
| Pricing | `/pricing` | Published Pricing content rendered through `PublishedPage.astro` |
| Contact | `/contact` | Published Contact content rendered through `PublishedPage.astro` |
| Privacy Policy | `/privacy-policy` | Published Privacy Policy content rendered through `PublishedPage.astro` |
| Posts | `/posts` | Post archive, available only with published posts |
| Work | `/projects` | Project archive, available only with published projects |

When editing content routes or discovery endpoints, follow [published-route rules](docs/published-routes.md).

## Schema

- `pages` collection: `title`, `layout` (page-builder blocks), optional `service` reference that scopes shared-content blocks (testimonials, pricing, faqs, team).
- No taxonomies.
- Four menus: `primary`, `footer_product`, `footer_company`, `footer_support`.

Site settings have `title` and `tagline`. Title renders in the header; tagline is used in the footer / metadata.

## Page builder

Pages are built from `emdash-plugin-page-builder` blocks in the `layout` field; the old Portable Text `content` field is retired from the schema and the templates. Rendering goes through `src/components/page-builder/PageLayout.astro`; the visual sections live in `src/components/blocks/`.

- The offered block list is `src/components/page-builder/offered-blocks.json`; regenerate the seed's `blockTypes` and `allowedTypes` from it with `node apps/marketing-site/scripts/sync-page-builder-seed.mjs` (typecheck runs it with `--check`).
- Apply the offered definitions to a live site with `pnpm --filter marketing-site page-builder` (wraps the `emdash-page-builder` CLI; needs `EMDASH_TOKEN`).
- Shared-content blocks (testimonials, pricing, faqs, team) read the matching collections scoped by the page's `service` reference; inline blocks (hero, cta, features, stats, comparison, prose) carry their own data.
- The plugin's publish policy blocks publishing a layout whose blocks miss required fields; block schema fields stay optional and the policy enforces on publish.
- Moving legacy Portable Text content into `layout` and retiring the old field are scripted: `scripts/move-content-to-layout.mjs` and `scripts/retire-pages-content.mjs` (plan by default, `--apply` to write).

## Visual character

Typography is **Inter** on `--font-sans` with weights up to 800 for headline emphasis. There is no mono font, no serif. Headline tracking is tight.

Colour is the loudest of any template here. The default palette is:

- `--color-primary: #6366f1` (indigo) -- main brand colour, used in buttons and links
- `--color-accent: #f472b6` (pink) -- paired with primary in gradients (CTA buttons, icon backgrounds)
- `--color-success`, `--color-warning` -- semantic colours for inline icons (pricing checkmarks)

Gradients are part of the look (`--color-primary` -> `--color-accent` on the "Get Started" button, on contact-method icons, on the "Most popular" pricing badge). Don't strip them entirely -- the template will look generic without them. Do swap them for a different pair if the brand calls for it.

Roundness is generous: `--radius` is 10px, `--radius-lg` 16px, plus a `--radius-full` for pills. Shadows are layered (`--shadow-sm` through `--shadow-xl`).

## Customisation

`src/styles/theme.css` is the only file to edit for visual changes. Every CSS variable from `Base.astro` is listed there as a commented default. The dark mode palette is defined inside `Base.astro`; light-mode overrides in `theme.css` won't affect dark mode. To customise dark mode, add `@media (prefers-color-scheme: dark)` and `:root.dark` rules in `theme.css`.

Fonts are configured in `astro.config.mjs` under `fonts:`. To swap the typeface, change the `name:` for the entry bound to `cssVariable: "--font-sans"`. Inter has 5 weights loaded (400-800) for hero impact -- if you swap, ensure the replacement has comparable weight range. Geist, Plus Jakarta Sans, Manrope, and DM Sans all work well as replacements.

CSS variables worth knowing:

- `--color-primary`, `--color-primary-dark`, `--color-primary-light`
- `--color-accent`, `--color-accent-light`
- `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-border`
- `--font-sans`
- `--font-size-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl}` -- type scale up to 4.5rem for the largest hero
- `--radius-sm` (6px), `--radius` (10px), `--radius-lg` (16px), `--radius-full`
- `--shadow-sm`, `--shadow`, `--shadow-lg`, `--shadow-xl`

To re-brand, the highest-leverage moves are:

1. Change `--color-primary` and `--color-accent` to the brand pair.
2. Update the site title (logo wordmark) and tagline.
3. Edit the home hero block's `heading` and `body` to specific, concrete copy.

## What not to do

- Don't write stock SaaS copy: "Build products people actually want", "Elevate your workflow", "The all-in-one platform for modern teams". These are placeholder. Write what the product actually does, for whom, with one specific outcome.
- Don't ship more than three pricing tiers. Three is the default for a reason -- more makes choice harder, not easier.
- Don't use icon and stock photo combos that fight each other. Pick illustration _or_ photography, not both.
- Don't enable the gradient on every interactive element. The CTA gradient is the signal; if it's on every button, it stops signalling.
- Don't add a hero block followed immediately by another hero block. One hero, then features / testimonials / pricing / FAQ in some order.
- Don't replace the `pricing` block with a hand-coded table. The block is the data shape downstream renderers expect.
