---
type: Lesson
title: Cloudflare bot_management enable_js injects challenge scripts even when fight_mode is false
description: Turning off Bot Fight Mode leaves bot_management.enable_js active on Cloudflare zones, injecting /cdn-cgi/challenge-platform/scripts/jsd/main.js and dropping Lighthouse Best Practices via Chrome deprecations.
tags: [cloudflare, bot-management, lighthouse, performance]
generated: { by: agy/gemini-4-carbon, at: 2026-11-16T11:39:00Z }
sources:
  - id: cf-api
    resource: https://developers.cloudflare.com/api/resources/bot_management/methods/update/
---

# Context
During an incognito mobile Lighthouse 13 audit of `https://jamesryan.dev/`, Best Practices scored `81` (`-19` points) solely because `/cdn-cgi/challenge-platform/scripts/jsd/main.js` triggered Chrome's `deprecations` audit (`StorageType.persistent is deprecated`), even though Bot Fight Mode (`fight_mode`) was already `false` on the zone. Inspecting `GET /zones/<zone_id>/bot_management` via the Cloudflare MCP revealed `{"enable_js": true, "fight_mode": false}`: Cloudflare's JavaScript detections toggle (`enable_js`) is independent of `fight_mode` and continues injecting the challenge-platform script into HTML responses until explicitly disabled.[^cf-api]

# Lesson
When anonymous public pages on a Cloudflare zone must not inject `/cdn-cgi/challenge-platform/scripts/jsd/main.js` (to avoid extra client JS and Lighthouse `deprecations` penalties), verify both `fight_mode: false` and `enable_js: false` on `/zones/<zone_id>/bot_management`.[^cf-api]

# How to apply
- Inspect `GET /zones/<zone_id>/bot_management` via `pnpm -s mcp:cloudflare` whenever `/cdn-cgi/challenge-platform/scripts/jsd/main.js` appears in DevTools or Lighthouse audits despite Bot Fight Mode appearing off.
- Update with `PUT /zones/<zone_id>/bot_management` setting `{"enable_js": false, "fight_mode": false}` (with James's confirmation on production zones) and re-verify that `/cdn-cgi/challenge-platform` is absent from HTML and network requests.

[^cf-api]: Cloudflare API — Bot Management Zone Configuration (`GET` / `PUT /zones/{zone_id}/bot_management`)
