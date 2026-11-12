---
module: emdash-site
problem_type: platform_quirk
tags: ["workers-og","satori","og-images","cloudflare-workers"]
---
### [2026-11-12] workers-og/satori requires display:flex on every div and compact HTML in OG image templates
workers-og (0.0.27, satori 0.15.2) renders HTML strings through Cloudflare's HTMLRewriter into a VDOM before satori. Two constraints follow:

1. The parser wraps even a single text child in a one-element array (`children: ["text"]`), so satori's check `m==="div" && children && typeof children !== "string" && display !== "flex" && display !== "none"` fires for **every** div that contains text, not just multi-child ones. Symptom: `Uncaught Error: Expected <div> to have explicit "display: flex" or "display: none" if it has more than one child node.` Fix: put `display: flex` (plus an explicit flex-direction where layout matters) on every div in the template.
2. Inter-tag whitespace (newlines/tabs between tags in a pretty-printed template) is emitted as real text nodes, adding children to parent divs. Fix: build compact, single-line markup.

Also: a bare `.woff` import in a Vite SSR build is externalized (breaks in workerd), and satori's fontkit cannot read WOFF2 — only WOFF1/TTF/OTF. To bundle fonts for OG rendering in Cloudflare Workers, embed base64 of `@fontsource/inter/files/inter-latin-<weight>-normal.woff` in a generated module (jamesryan-sites does this in packages/cms-helpers/src/og-fonts.ts with scripts/embed-og-fonts.mjs --check wired into typecheck) and decode once per isolate with atob.

After a first successful render, subsequent ImageResponse constructions log a benign `Error: Already initialized. The initWasm() function can be used only once.` — workers-og catches and swallows it; renders still succeed.
