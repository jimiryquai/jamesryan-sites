# Spike adaptations of emdash-visual-editor

Upstream: https://github.com/DavesAgenda/emdash-visual-editor pinned at
`08a5e7542d9fc12cb2452bfef2aff14acc139ae4` (MIT; `./LICENSE` is upstream's
license file, copyright Valid Agenda Pty Ltd). These files are a **throwaway
local-only experiment** for ticket 25; nothing here merges or ships.

Copied: `admin.tsx` (adapted), `frame.ts` (verbatim), `index.ts` (verbatim),
`LICENSE` (verbatim). Not copied: upstream `src/sections/` (its section
plugins, schemas, seed and `placeholders.json`), its page route, its
`astro.config.mjs`, its package tree.

## Changes to `admin.tsx` (each isolated and named)

0. **`// @ts-nocheck` added.** Upstream's file was written against its own
   tsconfig; this repo's stricter lib types (e.g. `Response.json()` -> `{}`)
   reject ~40 expressions. Kept verbatim rather than re-typed.

1. **Blocks field is `layout`, not `content`.** A single `const FIELD =
   "layout"` now drives: the `?field=` query param prefix, the draft load
   (`it.data.layout`), the `lastSent` initial body, the save `PUT` body, and
   the "block was rejected" attribution regex and friendly-error formatter
   (both accept `layout[i]` or `content[i]` paths). REST paths under
   `/_emdash/api/content/...` are EmDash's content-resource endpoints and are
   deliberately untouched; only `data.content` page-field references changed.
2. **`placeholders.json` supplied locally as `{}`.** Upstream imports
   `../../sections/placeholders.json` from its example section tree, which was
   not copied (its blocks are different definitions with overlapping slugs —
   hero/pricing/faq — and copying them would register a second block set).
   With `{}`, upstream's sample-content detection (`sampleFields`) is inert:
   no "Sample" badges, no publish confirmation about sample text. Block
   defaults still come from the real schema (`defaultValue` per field).
3. **Gallery restricted to the site's offered blocks.** The type map built
   from `/_emdash/api/schema/block-types` is filtered to the slugs in
   `src/components/page-builder/offered-blocks.json` (the site's single
   offered-blocks boundary), so nothing outside the ten page-builder blocks
   can be inserted from the gallery.

## Deliberately NOT changed (observed as-is, even where behaviour conflicts)

- The save filter that drops "incomplete" or server-rejected blocks from the
  PUT (`latest.current.filter((b) => !inc(b))` and the `rejected` retry loop).
  The brief for this spike is to demonstrate the behaviour, not fix it.
- `missing()` reading only schema `required` (this site's block fields are
  all optional by design for autosave; completeness lives in the page-builder
  package's `requiredToPublish`, which the editor cannot see).
- Lock acquisition failure being swallowed (`catch { return true; }`).
