---
module: emdash-site
problem_type: platform_quirk
tags: ["workers-og","satori","og-images","cloudflare-workers"]
---
### [2026-11-12] workers-og/satori: build OG cards as VNodes — the HTMLRewriter path is a trap
workers-og (0.0.27, satori 0.15.2) renders an HTML **string** through Cloudflare's `HTMLRewriter` into a VDOM before satori. That path has three traps, so pass Satori VNode objects (`{ type: "div", props: { style: { /* camelCase */ }, children } }`) to `new ImageResponse(...)` instead — when the element is not a string, workers-og skips HTMLRewriter completely:

1. **Entities are not decoded**: `TextChunk.text` yields literal `&amp;`/`&lt;` glyphs on the PNG, so HTML-escaping titles before interpolation corrupts them. VNode text children are plain JS strings — exact glyphs, no escaping, no injection surface.
2. The parser wraps even a single text child in a one-element array (`children: ["text"]`), so satori's check `m==="div" && children && typeof children !== "string" && display !== "flex" && display !== "none"` fires for **every** div that contains text. Keep `display: "flex"` on every div either way.
3. Inter-tag whitespace in a pretty-printed HTML template counts as child nodes. VNodes make this moot.

Satori VNode `props.style` keys are camelCase (`flexDirection`, `backgroundImage`, ...); numbers are px.

Also: a bare `.woff` import in a Vite SSR build is externalized (breaks in workerd), and satori's fontkit cannot read WOFF2 — only WOFF1/TTF/OTF. To bundle fonts for OG rendering in Cloudflare Workers, embed base64 of `@fontsource/inter/files/inter-latin-<weight>-normal.woff` in a generated module (jamesryan-sites does this in packages/cms-helpers/src/og-fonts.ts with scripts/embed-og-fonts.mjs --check wired into typecheck) and decode once per isolate with atob.

After a first successful render, subsequent ImageResponse constructions log a benign `Error: Already initialized. The initWasm() function can be used only once.` — workers-og catches and swallows it; renders still succeed.
