---
type: operations verification
title: Verification and quality checks
description: The layered check suite — root node --test scripts, per-package tests, isolated rendered-SEO workers over real seed data, staging smokes, Playwright/axe accessibility scans, and theme keyboard recordings.
tags: [testing, seo, accessibility, playwright, axe, smoke, ci]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-2259063a20830409cc3a930b
    resource: repo://docs/deploying.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-11cf3ce893fae68ed07d4bf2
    resource: repo://scripts/check-accessibility.mjs
  - id: openwiki-source-4867802290ae475699531466
    resource: repo://scripts/check-rendered-seo.sh
  - id: openwiki-source-6ff81b577edf4989b8fa7519
    resource: repo://scripts/check-theme.mjs
  - id: openwiki-source-dc4f0a449516d0c0b7757947
    resource: repo://scripts/smoke-staging.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

## Layout

The root `pnpm test` runs `node --test scripts/*.test.mjs` first, then every workspace package's own `test` script. Root scripts test operational machinery in isolation with faked boundaries (no test contacts Cloudflare): migration wrapper arguments, seed behavior, smoke retries, rendered-SEO validation, tracked-file and dead-remnant hygiene, MCP config shape, route delegation, and the theme logic. Packages test their units — `packages/astro-config` (config factory), `packages/cms-helpers` (discovery, feeds, llms, og, markdown, published routes, safe HTML, service content, identity, taxonomy archives), `packages/ui` (og-image, page fragments, seo-graph), and the marketing app (`scripts/*.test.mjs` + `test/usermaven.test.mjs`).

## Rendered SEO against a real Worker — `scripts/check-rendered-seo.sh`

CI runs it in `fixture` mode; locally `--real-seed` applies the complete marketing seed. For each `app:port:seed-option` entry it builds a **fresh, isolated** local environment under a `mktemp` state root (so simultaneous worktree checks can't collide, with an OS-chosen free port):

1. Derives a seed: fixture mode generates fixture seeds via `scripts/seo-fixture.mjs` (`seed`, `seed-unpublished`, `seed-garden-code`); `--real-seed` uses the app's committed `seed/seed.json`.
2. Applies it with `scripts/seed-local.mjs` into that isolated D1/R2 state.
3. Serves the **built** Worker with `wrangler dev --local --persist-to <state>` (killing it and any `wrangler.unconfigured.json` on exit). The `unpublished` variant strips `vars` from the wrangler config to test the no-settings path.
4. Validates over HTTP: `validate-rendered-seo.mjs` (metadata, alternates, validators), plus fixture-specific `verify`/`verify-unpublished`/`verify-code` checks, then `check-rendered-media.mjs` and `check-rendered-markdown.mjs` against the seeded content.

`RENDERED_EVIDENCE_DIR` (absolute) saves the media rows JSON and screenshots — screenshots require the Playwright Chromium install; CI checks images over HTTP without a browser.

## Staging smoke — `scripts/smoke-staging.mjs`

Run by Deploy after each staging deploy (and on production during promotion). Each target checks `/`, `/_emdash/admin/login`, `/robots.txt`, `/llms.txt`, `/sitemap.xml`, then one post URL parsed out of the sitemap. Failed endpoints retry every `SMOKE_RETRY_MS` (default 5s) within a shared `SMOKE_TIMEOUT_MS` deadline (default 3 minutes) with per-request timeouts capped at 15s; results are memoized per URL and each URL's last result is printed on failure. Marketing requires a published post; the garden passes `--posts=optional` and logs `no posts yet` when none exists.

## Accessibility and contrast — `scripts/check-accessibility.mjs`

Marketing-only in staging CI. Launches Playwright Chromium, enumerates the public sitemap plus deliberately unlisted pages (`/_emdash/admin/login`, `/search`), and requires a published post, whose title's first six words become a `/search?q=` URL so result snippets and `<mark>` highlights get contrast-scanned too. Every page is scanned in **light and dark** themes with axe tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, `best-practice`; only `serious`/`critical` violations fail the run. Full axe JSON per page, plus extracted color-contrast pairs per theme/mode, land in `.scratch/accessibility/` (uploaded as a workflow artifact even on failure). It also reuses `check-comment-fields.mjs` for comment-form field checks.

## Theme behavior recording — `scripts/check-theme.mjs`

Run manually against an already-running, locally seeded marketing Worker (`node scripts/check-theme.mjs http://127.0.0.1:14321 .scratch/theme`). It drives the theme menu with the keyboard only — menu open/`aria-expanded`, `menuitemradio` checked state, focus movement with ArrowDown/ArrowUp/Home — while recording video, asserting persistence, keyboard controls, and mobile layout behavior. Shared browser helpers live in `scripts/accessibility-browser.mjs`.
