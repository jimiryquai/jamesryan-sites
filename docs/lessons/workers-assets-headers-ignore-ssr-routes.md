---
type: Lesson
title: Cloudflare Workers Assets ignores public/_headers on SSR routes
description: Under @astrojs/cloudflare Workers Assets, public/_headers applies only to static asset responses, never to Worker-rendered APIRoute or .astro responses.
tags: [cloudflare, astro, headers, caching]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T18:52:00Z }
sources:
  - id: ticket
    resource: .scratch/baseline/issues/32-a552c031-enforce-published-filtering-cache-hints-url-normalization-an.md
  - id: headers-file
    resource: apps/marketing-site/public/_headers
---

# Context
During the Ticket 13 codebase review, `apps/marketing-site/public/_headers` and `apps/digital-garden/public/_headers` declared `Access-Control-Allow-Origin: *`, `Cache-Control`, and `No-Vary-Search` rules for `/.well-known/*`, `/schema/*`, `/schemamap.xml`, `/sitemap.xml`, and `/*`.[^headers-file] Because both apps run `output: "server"` on `@astrojs/cloudflare` with Workers Assets, Cloudflare's static asset layer only attaches `_headers` rules to static files served from the assets binding (such as `/_astro/*` or `favicon.svg`), while Worker-rendered SSR `APIRoute` and `.astro` responses bypass `_headers` completely — silently omitting expected CORS and cache headers on `/schema/*.json` and `/sitemap.xml`.[^ticket]

# Lesson
In `@astrojs/cloudflare` SSR apps, treat `public/_headers` as static-asset-only configuration; set CORS, security, and `Cache-Control` headers for `APIRoute` and `.astro` responses in Worker/Astro code (and verify them in rendered HTTP checks).[^ticket]

# How to apply
- Scope `public/_headers` strictly to static asset paths served from `dist/client` (e.g. `/_astro/*`).
- Attach `Access-Control-Allow-Origin`, `Cache-Control`, and `Vary` headers directly on `Response` objects (or shared SSR response helpers / Astro middleware) for dynamic routes like `/schema/*`, `/sitemap.xml`, `/rss.xml`, and `/.well-known/*`.
- Assert required response headers against a running server in `scripts/check-rendered-seo.sh` rather than checking `_headers` text statically.

[^ticket]: Ticket 32 (`32-a552c031`, filed during Ticket 13 codebase review)
[^headers-file]: `apps/marketing-site/public/_headers`
