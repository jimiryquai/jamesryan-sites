---
type: Lesson
title: Pass Satori VNodes and bundled WOFF1 bytes to workers-og instead of HTML strings
description: workers-og's HTMLRewriter string parser leaves HTML entities un-decoded in PNG output and requires display:flex on every element, while Satori's fontkit rejects WOFF2.
tags: [cloudflare, og-images, workers-og, satori]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T20:20:00Z }
sources:
  - id: ticket
    resource: .scratch/baseline/issues/31-3370abcf-fix-opengraph-image-route-prefixes-html-escaping-draft-cachi.md
  - id: og-module
    resource: packages/cms-helpers/src/og.ts
---

# Context
While implementing shared OpenGraph PNG generation in `packages/cms-helpers/src/og.ts` (`Ticket 31`), passing HTML strings into `workers-og@0.0.27`'s `new ImageResponse(html, ...)` exposed three failure modes:[^ticket]
1. `workers-og` parses HTML strings with Cloudflare's `HTMLRewriter.on("*", { text(chunk) })`, whose `chunk.text` does **not** decode HTML entities — so HTML-escaping `"C# & .NET"` into `"C# &amp; .NET"` renders the literal characters `&amp;` onto the PNG, while leaving strings unescaped allows markup injection or broken parses.
2. `workers-og` wraps text chunks and inter-tag whitespace in `children` arrays, causing Satori to throw whenever any `<div>` omits `display: flex`.
3. Satori's embedded `fontkit` supports WOFF1/TTF/OTF (`wOFF` magic bytes) and rejects WOFF2, and Vite SSR builds can externalize `.woff` asset imports out of `workerd`.[^og-module]

# Lesson
Bypass `workers-og`'s `HTMLRewriter` string parser altogether by passing Satori VNode objects (`{ type: "div", props: { style: { display: "flex", ...camelCaseStyle }, children } }`) directly to `new ImageResponse(vnode, ...)`, and bundle base64-encoded WOFF1 font bytes in a generated module.[^og-module]

# How to apply
- Construct Satori VNode objects with camelCase `props.style` properties and `display: "flex"` on every `div`; pass CMS strings directly as `children` so `&`, `<`, `>`, `"`, and `'` render as exact glyphs with zero HTML parser or injection surface.
- Embed latin WOFF1 subsets from `@fontsource/*` (`devDependencies`) into a generated `.ts` module verified with `--check` in `pnpm typecheck`, avoiding runtime `loadGoogleFont` calls and WOFF2 parse errors.
- Unit tests that mock `ImageResponse` must inspect the VNode tree (and pair with a real `wrangler dev` PNG check in `scripts/seo-fixture.mjs` containing `&` and `_preview` tokens).

[^ticket]: Ticket 31 (`31-3370abcf`, PR #39)
[^og-module]: `packages/cms-helpers/src/og.ts` and `packages/cms-helpers/scripts/embed-og-fonts.mjs`
