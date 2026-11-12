---
okf_version: 0.2
---

# Lessons

## accessibility

* [Cookie-forced theme tests mask broken cookie-less System dark mode](cookie-forced-theme-tests-mask-system-dark-mode.md) - Setting `Cookie: theme=light|dark` in Playwright skips the default `System` theme state where `<html>` has neither `.light` nor `.dark`, hiding scoped `:global(.dark)` CSS bugs on dark OSes.
* [Place Tailwind v4 @variant dark rules after equal-specificity light rules](tailwind-custom-variant-dark-zero-specificity.md) - Because `@custom-variant dark` expands with zero-specificity `:where(.dark, .dark *)`, `@variant dark` blocks placed above light-mode rules lose the CSS cascade in both `.dark` and `system-dark` modes.

## cloudflare

* [Cloudflare Workers Assets ignores public/_headers on SSR routes](workers-assets-headers-ignore-ssr-routes.md) - Under `@astrojs/cloudflare` Workers Assets, `public/_headers` applies only to static asset responses, never to Worker-rendered `APIRoute` or `.astro` responses.
* [Pass Satori VNodes and bundled WOFF1 bytes to workers-og instead of HTML strings](workers-og-vnodes-and-bundled-woff1.md) - `workers-og`'s `HTMLRewriter` string parser leaves HTML entities un-decoded in PNG output and requires `display: flex` on every element, while Satori's `fontkit` rejects WOFF2.

## emdash

* [Workspace Astro UI packages need their own astro check and canonical platform unions](workspace-package-typecheck-and-emdash-placements.md) - App-level `astro check` skips workspace dependency packages resolved via `node_modules`, allowing type mismatches against EmDash unions like `PagePlacement` (`"body:start"` vs `"body-start"`) to pass CI silently.

## usermaven

* [Usermaven's browser SDK keeps a localStorage retry buffer and requires tagged form tracking](usermaven-sdk-storage-and-tagged-forms.md) - `lib.js` unconditionally writes `usermaven_offline_queue_default_data` to `localStorage` even in strict cookieless mode, and `data-form-tracking="all"` captures raw input values across every `<form>`, so keep `data-form-tracking="tagged"` and opt in marketing forms with `data-um-form`.
