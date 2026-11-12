# Visual editor compatibility spike (ticket 25)

**Question:** can [DavesAgenda/emdash-visual-editor](https://github.com/DavesAgenda/emdash-visual-editor) (MIT, pinned `08a5e7542d9fc12cb2452bfef2aff14acc139ae4`, tested by its author against EmDash 1.1) edit this site's ten page-builder blocks on EmDash 1.5?

**Answer: yes for selection, plain fields, variants and repeater panel editing — but not adoptable as-is.** The editor's "leave rejected sections out of the draft" save rule destroys whole blocks on this site's validated schemas (demonstrated, with permanent loss after the tab closes), it cannot see `requiredToPublish` (publish errors arrive as opaque server rejections), and shared-content blocks edit only their controls, never their collection items. **Recommendation: fork as a package** — details below.

This note is backed by a local browser run: `bash .orchestrate/spike/run-local.sh` then `node .orchestrate/spike/experiment.mjs` (57/57 checks, 2026-11-12). Raw log: `.orchestrate/evidence/25-experiment-log.json`; screenshots: `.orchestrate/evidence/25-*.png`. Everything ran on an isolated seeded local database (port 4337, fixture dev admin via EmDash's dev-only setup bypass); no live system was touched.

## How it was wired (throwaway; nothing merges)

- `apps/marketing-site/src/plugins/visual-editor/` — upstream `admin.tsx` (adapted), `frame.ts` and `index.ts` (verbatim), MIT `LICENSE`, and `ADAPTATIONS.md` naming every change: blocks field `content`→`layout` (one `FIELD` constant; REST `/​_emdash/api/content/...` paths untouched), local empty `placeholders.json` replacing the external `src/sections/` import, gallery restricted to the site's ten offered slugs, `@ts-nocheck` (upstream tsconfig mismatch).
- `apps/marketing-site/src/components/page-builder/vx-edit.ts` plus marker threading through all ten site block components (`veSection` on section roots — the UI kit already spreads rest props onto `<section>`, so markers land on real geometry without any package copy — and `ed()` on text leaves through the UI kit's `headline`/`subheadline`/`stat` slots). `emdash-plugin-page-builder` **0.5.0 from npm, unmodified**; its 0.5.0 `edit` prop (static attribute bag) was not used.
- `PublishedPage.astro` renders the `#vx-blocks` container and injects `FRAME_JS` only when `vx_frame=1` **and** `getRequestContext().preview` is set (EmDash's *verified* preview context), with `Cache-Control: private, no-store`.
- Registered as a native plugin (`entrypoint`/`adminEntry`/`adminPages`) in `astro.config.mjs`; EmDash 1.5's admin loaded it unchanged.

## The ten blocks

| Block | Verdict (browser-proven) | Why / limits |
|---|---|---|
| hero | **Edits well.** Click-select, heading/body live-patch as you type, eyebrow click-selects (marker on the badge anchor; no live patch — refresh after save), variant switch photo↔centered refreshes, image replace from the seeded media library (stored `{id,provider,src,alt,width,height,meta}` verified), links repeater add/edit/remove persists. | Live patch works because markers sit on childless slot spans. |
| cta | **Edits well — and is the failure exhibit.** Heading/body/variant fine; `+ Add item` writes `url: ""`, EmDash 1.5 rejects the PUT (`layout[1].links.1.url: URL must use http, https, mailto, or tel…`), and upstream **drops the whole block from the saved draft** ("set aside"), showing "Draft saved · 1 section needs details". | Screenshots `25-07-cta-rejected-set-aside`, `25-cta-lost-after-reload`; see "Save filtering" below. |
| features | **Edits well.** Nested repeater items (title/description) persist and reorder; item titles are clickable in the frame (`items.N.title` markers); all four variants render after refresh. | Repeater subfield typing is not live-patched (upstream design: panel-only until save+refresh — verified: the frame catches up after the save's refresh). |
| stats | **Edits well.** Heading/body/eyebrow via slots; `items.N.value`/`items.N.label` markers through `Stat` slots; value edits persist and reach the frame on refresh. | Same refresh-not-live caveat for items. |
| comparison | **Panel-only.** Columns+rows repeaters editable in the panel; row-name edits persist *and* render (after refresh). Column-label edits save with **no visual effect** — this site's renderer hard-codes Starter/Growth/Pro headers (pre-existing renderer limitation, not editor failure). | No leaf markers (table cells are internal to `PlanComparisonTable`); clicks select the block only. |
| prose | **Half.** Heading/body editable inline; the Portable Text `content` field deliberately points at the classic editor (upstream renders a link, no panel editor). PT content survived every save untouched (verified blocks: 1). | Full in-place formatted editing is out of scope for this editor. |
| pricing | **Controls only.** variant (single/tiers/toggle) + scope edit and persist; prices/descriptions/features live in the `pricing` collection and are **not editable here** (correctly so — the panel offers no fake fields). | Collection-item editing needs a different boundary (see recommendation). |
| testimonials | **Controls only.** variant single/split/grid + scope + count; quote/author/avatar come from the collection. Collection items carry **no** field markers (verified 0 markers inside the section) — a quote click selects the block, never invents a `quote` field. | |
| faq | **Controls only.** variant two-column/centered + scope + count; questions/answers live in the `faqs` collection. | |
| team | **Controls only.** variant three/four-column + scope + count; names/roles/photos live in the `team` collection. | |

Selection geometry is real everywhere: markers sit on the actual `<section>` roots, so hover outlines, the floating tag and `scrollIntoView` all behave (the preflight's `display:contents` worry applies only to the unused 0.5.0 `edit`-prop route).

## Structure operations

Move up/down, duplicate, delete (with confirm) and Ctrl+Z undo all work and persist; the optimistic reorder plus post-save refresh holds up across all layouts tested (including the empty-block case on `vx-blank`). The gallery offers **exactly the ten offered blocks** (filtered to `offered-blocks.json`; verified). An unknown `_type` is rejected by the API itself: `409 UNSUPPORTED_FIELD_TYPE: layout[0]._type: block type "mystery-block" is unavailable`.

## Version gap (1.1-tested upstream vs EmDash 1.5 here)

- Works on 1.5 without source changes: plugin registration (`adminEntry`/`adminPages`), page list/entry GET, `PUT /content/...`, `preview-url` (returns `url`; upstream reads `previewUrl || url`), publish, locks (status `enabled`/`heldByCaller`/`holder` observed working in a single-tab session), media list/pick, `X-EmDash-Request` CSRF header.
- New-in-1.5 frictions found: url-type fields are **validated server-side** (the empty-URL repeater default above); block-type availability is enforced on PUT (409); first-login welcome dialog overlays the admin (cosmetic); EmDash 1.5 also ships its own `/_emdash/api/visual-editing/...` route family — upstream in-place editing may be converging in EmDash itself (untested here, noted for the "wait" option).
- Not tested: multi-tab lock takeover, `room` lock semantics, revisions UI.

## Save filtering vs requiredToPublish — the material conflict

Three distinct behaviours, all browser-proven:

1. **Incomplete blocks are kept.** Because the package deliberately makes block fields optional (autosave design), upstream's `missing()` (schema-`required` only) never flags them: a blank hero stays in the saved draft. Good.
2. **Server-rejected blocks are silently dropped from the draft.** A block whose PUT fails validation is "set aside" and *excluded from every subsequent save* until edited again. The status bar still says "Draft saved"; the panel shows a "left out of the draft" note; **closing the tab loses the block permanently** — demonstrated: after the editor tab closed, the CTA was gone from the page (9 sections left; screenshot `25-cta-lost-after-reload.png`). This is upstream's stated design ("unfinished sections never block your work") colliding with EmDash 1.5's stricter validation — upstream never meets a 400 on its own 1.1 example schemas.
3. **A repair race.** Filling a second repeater subfield before the first fill's PUT round-trip completes lets the 400 re-mark the block rejected *after* the second fill cleared it; the valid item then never saves (paced fills work; quick successive fills wedge until the block is edited again).

`requiredToPublish` is invisible to the editor: publishing the blank hero is rejected by the package's own `content:beforePublish` hook with `Missing required block fields: hero (…): heading` surfaced as a raw "Couldn't publish (…)" banner with a retry button; filling the heading makes publish succeed (published page verified). Note the hook accepted a hero with an *empty* `links` array (heading is the only hard requirement there). The editor can neither predict nor explain these rules from the schema alone — a fork should expose the package's exported `findMissingToPublish` through one adapter instead.

## Preview boundary and security

- Markers and the frame bridge appear **only** behind a verified signed preview plus `vx_frame=1`; the response is `private, no-store` (verified).
- Forged `?_preview=bad&vx_frame=1` (with and without a session): HTTP 200 serving the **published** revision, zero markers, no draft edits (verified: pre-edit heading present, edited heading absent).
- Signed-out public HTML: no `data-vx-*`, no `vx-blocks`, no bridge script.
- The site's published-route helper was kept authoritative (no independent CMS query).

## Nested repeaters and images (specific asks)

- Nested repeater fields (features items, stats items, cta/hero links, comparison columns+rows) all edit and persist through the panel; item text is clickable in the frame where site components own the leaf. No live patching inside repeaters (by upstream design).
- Images: hero image replaced from the seeded local media library through upstream's picker; the stored object and the rendered `_image` URL verified. No alt-text editor, no dark-variant handling (package 0.5 `options.darkVariant` unused by the editor), untouched values preserved. Media upload not exercised (local R2 fixture used instead; upstream README expects R2).

## Telemetry

- Static review (preflight): no analytics SDKs, beacons or third-party endpoints in the three plugin files; all fetches same-origin (`/_emdash/api`, the signed preview URL); `postMessage` targets `location.origin`.
- Runtime audit (this run): **347/347 browser requests went to `127.0.0.1:4337`** — zero third-party hosts from the admin or the preview frame (the site's own UserMaven init logs but sends through its same-origin proxy; nothing external). Dev/build/preview commands run with `ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false`, and `wrangler.jsonc` sets `send_metrics: false`.
- Nothing to switch off; a fork should keep it that way.

## Recommendation: fork as a package

- **Adopt: no.** Hard-coded `content` field, external `placeholders.json`, the block-dropping save rule, no `requiredToPublish` awareness, and no shared-collection editing boundary.
- **Fork: yes — small, hidden behind one adapter.** The core (click-select, live patching, optimistic reorder, in-place refresh, locks, media picker) works on 1.5 today. A fork should (a) route the blocks field, offered types, labels and preview URL through one adapter (this spike's `FIELD`/filter changes, upstreamed cleanly); (b) **fail saves visibly instead of omitting rejected blocks** — keep every block in the draft and surface the server's per-block error (EmDash already returns precise `layout[i].field` paths); (c) show the package's real publish requirements via `findMissingToPublish`; (d) keep collection-backed blocks control-only and add an explicit "edit in collection" navigation seam rather than fake inline fields.
- **Build our own: not justified by this evidence.** The marker plumbing on the site side (roots via rest-prop spread, leaves via UI-kit slots) is ~1 line per field and no package changes were needed.
- **Wait for EmDash upstream: plausible but unproven.** 1.5 already ships `visual-editing` API routes (untested here); if EmDash ships first-party in-place editing, the fork shrinks or dies. Worth a quick check before investing in the fork.

## Reproduce

```bash
bash .orchestrate/spike/run-local.sh     # build, seed isolated DB on :4337, serve (fixture dev admin via dev-bypass)
node .orchestrate/spike/experiment.mjs   # full 57-check browser proof; screenshots + log into .orchestrate/evidence/
# editor UI: http://127.0.0.1:4337/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
#            then /_emdash/admin/plugins/visual-editor/
# stop: cd apps/marketing-site && ./node_modules/.bin/astro dev stop --config spike.config.mjs
```
