# EmDash Marketing Template (Cloudflare)

A conversion-focused landing page template built with [EmDash](https://github.com/emdash-cms/emdash) and deployed on Cloudflare Workers with D1 and R2. Modular content blocks let you assemble pages from reusable sections without touching code.

![Marketing template homepage](https://raw.githubusercontent.com/emdash-cms/emdash/main/assets/templates/marketing/latest/homepage-light-desktop.jpg)

## What's Included

- Hero section with CTAs
- Feature grid
- Testimonials
- Pricing cards
- FAQ accordion
- Contact form with validation
- SEO metadata and JSON-LD
- Dark/light mode

## Pages

| Page | Route |
|---|---|
| Homepage | `/` |
| Pricing | `/pricing` |
| Contact | `/contact` |
| 404 | fallback |

## Screenshots

| | Desktop | Mobile |
|---|---|---|
| Light | ![homepage light desktop](https://raw.githubusercontent.com/emdash-cms/emdash/main/assets/templates/marketing/latest/homepage-light-desktop.jpg) | ![homepage light mobile](https://raw.githubusercontent.com/emdash-cms/emdash/main/assets/templates/marketing/latest/homepage-light-mobile.jpg) |
| Dark | ![homepage dark desktop](https://raw.githubusercontent.com/emdash-cms/emdash/main/assets/templates/marketing/latest/homepage-dark-desktop.jpg) | ![homepage dark mobile](https://raw.githubusercontent.com/emdash-cms/emdash/main/assets/templates/marketing/latest/homepage-dark-mobile.jpg) |

## Infrastructure

- **Runtime:** Cloudflare Workers
- **Database:** D1
- **Storage:** R2
- **Framework:** Astro with `@astrojs/cloudflare`

## Local Development

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

### Admin UI & Auth Dev Bypass

The admin dashboards can be accessed at:
- **Marketing Site**: [http://localhost:4321/_emdash/admin](http://localhost:4321/_emdash/admin)
- **Digital Garden**: [http://localhost:4322/_emdash/admin](http://localhost:4322/_emdash/admin)

If you ever lose or invalidate your local passkeys, you can bypass the authentication gate in development by navigating to:
- **Marketing Site Bypass**: [http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin](http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin)
- **Digital Garden Bypass**: [http://localhost:4322/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin](http://localhost:4322/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin)

## Deploying

See [deployment instructions](docs/deploying.md).

## See Also

- [Node.js variant](../marketing) -- same template using SQLite and local file storage
- [All templates](../)
- [EmDash documentation](https://github.com/emdash-cms/emdash/tree/main/docs)

### Marketing seed media

Marketing content uses committed files in `apps/marketing-site/seed/assets/`.
Keep `$media.file` paths relative to `seed/seed.json`; alt text and captions belong
to each reference. The garden seed is unchanged.

After `pnpm build`, run `bash scripts/check-rendered-seo.sh --real-seed` to apply
the complete marketing seed to a fresh, isolated local D1 database, import its
uploads into local R2, and check the built Worker. No staging access is needed.
To save media rows and home/post screenshots, set `RENDERED_EVIDENCE_DIR` to an
absolute directory when running that command. Screenshot capture requires
`pnpm exec playwright install chromium`; CI checks images over HTTP without a browser.

To repair a new export, read the source site's `media` table using Wrangler's
`d1 execute ... --remote --command 'SELECT * FROM media' --json`, save that output,
then run from the repository root:

```bash
node scripts/seed-media.mjs apps/marketing-site/seed/seed.json media-rows.json https://staging.jamesryan.dev
```

The script only downloads images and writes local assets and the seed. It uses
media row storage keys, preserves content alt text and captions, rejects filename
collisions, and verifies files on a rerun. Review and commit both the JSON and assets.

EmDash's [seed documentation](https://docs.emdashcms.com/themes/seed-files/)
describes local files, but published 1.4.0 only resolves URL references. The pinned
`patches/emdash@1.4.0.patch` supplies local file resolution for the CLI and
programmatic `mediaBasePath` callers, reusing EmDash's upload, dimensions and hash
deduplication. It rejects absolute paths and escapes through parent paths or
symlinks. Remove the patch when a released EmDash version implements this API;
`scripts/seed-local.test.mjs` checks the real CLI behavior. Local files are not
bundled into Workers; seed with the Node CLI before serving local R2 media.
