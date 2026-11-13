---
type: routing subsystem
title: Usermaven analytics proxy
description: The marketing-only /s1/* Usermaven proxy — first-party script and event forwarding with strict header filtering, bounded bodies, key gating, and no shared caching.
tags: [usermaven, analytics, proxy, privacy, cloudflare-workers]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-81fbcca8ea780cb16e888037
    resource: repo://apps/marketing-site/src/components/UsermavenAnalytics.astro
  - id: openwiki-source-0ffdab26762af9eeac4696a2
    resource: repo://apps/marketing-site/src/pages/s1/%5B...path%5D.ts
  - id: openwiki-source-33c11b9caaf13d1065ca4f0c
    resource: repo://apps/marketing-site/src/utils/usermaven.ts
  - id: openwiki-source-f082439d08a13f054bcff398
    resource: repo://apps/marketing-site/test/usermaven.test.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

Marketing runs Usermaven analytics through a first-party proxy so visitors only ever talk to `jamesryan.dev`: `apps/marketing-site/src/utils/usermaven.ts` implements it, `src/pages/s1/[...path].ts` (an `ALL`-method API route) wires it to the Worker env (`USERMAVEN_KEY`, optional `USERMAVEN_EVENTS_ORIGIN`), and `UsermavenAnalytics.astro` injects the tracker snippet only when the key resolves.

## Routing

`/s1` is a subdirectory proxy: `/s1/lib.js` maps to the script origin `t.usermaven.com`; every other `/s1/*` path maps to the events origin `events.usermaven.com` with the prefix stripped, query preserved. Method allowlists differ — script: GET/HEAD; events: GET/HEAD/POST — anything else gets 405 with an `Allow` header. Path safety is checked on both the raw and decoded suffix (rejecting `//`, backslashes, `%2e`/`%2f`/`%5c` and `..` segments; malformed encodings 400), and the rebuilt upstream URL must stay on the intended origin.

## Privacy and safety rules

- **Header filtering.** Only `accept`, `accept-language`, `content-type`, `referer`, and `user-agent` are forwarded. `cookie`, `authorization`, and client-supplied `x-forwarded-for` are never copied; instead the Worker's own `cf-connecting-ip` becomes `x-forwarded-for`, which Usermaven's event API uses for geolocation/device enrichment.
- **Bounded bodies.** Event payloads are capped at 64 KiB (413 above; a Content-Length over the cap short-circuits before reading, and rejected requests drain at most 16 KiB of body before responding), so a single request cannot buffer unbounded Worker memory.
- **Key gating.** A missing, blank, or whitespace-only `USERMAVEN_KEY` makes every `/s1/*` request 404 **without contacting upstream** — the proxy disappears rather than leaking. The key itself is never sent in a response; it lives in the wrangler `vars` and in the tracker's `data-key` attribute on the injected script tag.
- **Local testing.** The events origin override (`USERMAVEN_EVENTS_ORIGIN`) is honored only when it is a well-formed loopback origin and the request itself is loopback; malformed or non-local overrides are ignored in favor of production.

## Caching

The proxy opts out of Astro's route cache (`cache.set(false)`) and answers `no-store` everywhere — 4xx/5xx and all event traffic — with one deliberate exception: a successful `/s1/lib.js` fetch is `private, max-age=3600` so the tracker script is browser-cacheable without entering any shared cache. Upstream failures surface as 502 `no-store`; only `content-type` is copied from the upstream response.

`apps/marketing-site/test/usermaven.test.mjs` covers the matrix: key-gated 404s without upstream fetch, unsafe paths, method rules, body limits, forwarded headers (never cookie/authorization/client XFF), and the script cache header.
