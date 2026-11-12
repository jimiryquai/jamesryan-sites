---
okf_version: 0.2
---

# Lessons

## accessibility

* [Cookie-forced theme tests mask broken cookie-less System dark mode](cookie-forced-theme-tests-mask-system-dark-mode.md) - Setting `Cookie: theme=light|dark` in Playwright skips the default `System` theme state where `<html>` has neither `.light` nor `.dark`, hiding scoped `:global(.dark)` CSS bugs on dark OSes.

## cloudflare

* [Cloudflare Workers Assets ignores public/_headers on SSR routes](workers-assets-headers-ignore-ssr-routes.md) - Under `@astrojs/cloudflare` Workers Assets, `public/_headers` applies only to static asset responses, never to Worker-rendered `APIRoute` or `.astro` responses.

## usermaven

* [Usermaven's browser SDK keeps a localStorage retry buffer and requires tagged form tracking](usermaven-sdk-storage-and-tagged-forms.md) - `lib.js` unconditionally writes `usermaven_offline_queue_default_data` to `localStorage` even in strict cookieless mode, and `data-form-tracking="all"` captures raw input values across every `<form>`, so keep `data-form-tracking="tagged"` and opt in marketing forms with `data-um-form`.
