# 20-7e4cc9a3: Seed carries its own images so fresh databases show real media

**Spec:** docs/specs/baseline.md

**What to build:**

Found on ticket 09 (2026-11-09). Every image is broken in a fresh database: local dev, CI's rendered checks, screenshots, and any agent working locally. Only staging and production show images, because their media lives in R2.

Why: `apps/marketing-site/seed/seed.json` was exported without media. Each `featured_image` is a stored reference to a Media Library item (`provider: "local"`, `id: 01KRVBS…`, `src: /_emdash/api/media/file/….webp`), the seed has no `$media` entries, and a fresh database has neither the media rows nor the files. `seed/uploads/` holds 14 images under different IDs (`01KS85…`) and is gitignored (`.gitignore:14 uploads/`), so nothing connects them.

EmDash's documented route (https://docs.emdashcms.com/themes/seed-files/, `emdash export-seed`; read it through mcporter):

- A `$media` reference with `file: "assets/<name>"` uploads a local file and creates a real media row, with alt text and dimensions. `emdash seed` resolves it against the seed's own directory.
- `export-seed --with-content` writes image fields, and image sub-fields of repeaters, as `$media`. But images inside Portable Text keep their stored IDs, which don't resolve on another site, and without `--media-base-url` the `$media` URLs are relative and skipped.

1. **Get the real images:** take each image the marketing seed's content uses from staging, read-only. Staging was copied from production in ticket 05, so it holds the same media. Use the D1 media rows for filenames and alt text, and R2 for the files: `wrangler r2 object get … --remote`, or the site's public `/_emdash/api/media/file/` URL. Save them as `apps/marketing-site/seed/assets/<slug>.<ext>`, committed.
2. **Rewrite the seed's media references to `$media` with `file:`.** That covers featured images, image fields, and images inside Portable Text (`asset.$media`). Keep each image's existing alt text and captions exactly; they're James's copy. Prefer a script you can run again (for example `scripts/seed-media.mjs`) over a hand edit, so the next export can be fixed the same way.
3. **Use them:** CI's rendered check (`scripts/check-rendered-seo.sh`) stops passing `--skip-media` wherever the seed can now be applied with media, so images (and their alt text) are checked for real. Local dev gets images on a fresh seed.
4. Delete the stale gitignored `seed/uploads/` from the README or docs if anything mentions it; don't commit it.

Marketing site only (the garden is out of scope). No copy changes.

**Blocked by:** none.

**Status:** in progress

- [ ] A fresh local seed of the marketing site shows every post and page image, with its original alt text (screenshot and a list of the media rows created).
- [ ] The seed holds no Media Library IDs that only exist in production: every image is a `$media` reference to a committed file under `seed/assets/`.
- [ ] CI's rendered check applies the seed with media and passes.

## Comments

**2026-11-09 Claude (orchestrator):** Raised after James asked why local runs have no images. Risk: medium (the seed and a CI script; no copy).
