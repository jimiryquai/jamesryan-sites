---
type: architecture module
title: Site config factory
description: createSiteConfig in packages/astro-config centralizes every Astro, Cloudflare, and EmDash config decision, including build-time stylesheet inlining and responsive image domains, leaving each app to pass only its deployment differences.
tags: [astro, configuration, factory, emdash, plugins, vite, css-inlining]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-16T14:08:20.656Z
sources:
  - id: openwiki-source-5a4199fd6493c4ad487fcca0
    resource: repo://apps/digital-garden/astro.config.mjs
  - id: openwiki-source-6fcf62658729324461e93e00
    resource: repo://apps/marketing-site/astro.config.mjs
  - id: openwiki-source-fdc3598f8adeb795fc2861ab
    resource: repo://packages/astro-config/index.mjs
  - id: openwiki-source-fdb1fb9ffa9bbb7790b408d5
    resource: repo://packages/astro-config/test/config.test.mjs
generated: { by: "claude-code", at: "2026-11-16T14:08:20.656Z" }
---

`packages/astro-config/index.mjs` exports `createSiteConfig({ site, port, inspectorPort, appRootUrl, redirects, displayFont, extraPlugins, sandboxedPlugins })`, the single place platform wiring is decided. Each app's `astro.config.mjs` imports the factory directly (relative path keeps it in Astro's config bundle so TypeScript plugin entries are transformed) and supplies only deployment differences:

- **marketing-site** — `https://jamesryan.dev`, port 4321, inspector 9229, Instrument Serif display font, `extraPlugins: [pageBuilderPlugin()]`, `sandboxedPlugins: [aiCommentModeration]`.
- **digital-garden** — `https://jamesryan.me`, port 4322, inspector 9230, Familjen Grotesk display font, redirect `/blog` → `/`, no extra or sandboxed plugins.

`packages/astro-config/test/config.test.mjs` loads both real app configs through module mocks and asserts these differences survive the factory, plus every shared decision below, and verifies that both apps declare local `IMAGES` bindings in production and staging with tracked `Env` types.

## What the factory decides

- **Rendering model and stylesheet inlining**: `output: "server"` — required because content is live CMS data (`getStaticPaths()` is incompatible), with `compressHTML: true` preserved for inline spacing across the Astro 6→7 compiler upgrade, and `build: { inlineStylesheets: "always" }` so routes emit inline `<style>` tags rather than render-blocking `/_astro/*.css` stylesheet links.
- **Adapter**: `@astrojs/cloudflare`, with the dev inspector port enabled only when running `astro dev`.
- **Images**: `layout: "constrained"`, `responsiveStyles: true`, and image domains derived from the app's own hostname (`hostname`, `staging.${hostname}`, `localhost`, `127.0.0.1`, plus `**.${hostname}` HTTPS remote patterns) — deployment facts stay parameters, platform rules stay code, and local `127.0.0.1` workers can optimize same-origin `/_emdash/api/media/file/*` assets via `/_image`.
- **Vite**: the Tailwind v4 plugin, `.wrangler/**` excluded from watch, and SSR `optimizeDeps` for the handful of app dependencies that otherwise trigger Worker reloads mid-render (`astro-iconset/components`, the SEO graph pair, `clsx/lite`, `workers-og`).
- **Integrations**: React; `astro-seo-graph` validators (`validateH1`, unique metadata, image alt, metadata length, internal links skipping `/api/*` and `/_emdash/*`, markdown alternates); a curated `astro-iconset` allowlist of ~20 Phosphor icons so the full `@iconify-json/ph` set never bloats the Worker bundle; and the EmDash integration itself.
- **EmDash integration**: D1 `DB` binding with auto sessions, R2 `MEDIA` storage, `sandbox()` runner with the app's `sandboxed` plugin list, `mcp: true`, migrations `runtime: "check"` / `dev: "auto"` (see [Cloudflare and EmDash runtime](cloudflare-emdash-runtime.md)), and a native plugin list: a patched SEO plugin plus code-block-pro, then the app's `extraPlugins`.
- **Fonts**: Google-hosted Inter as `--font-sans` plus the app's `displayFont` mapped to `--font-display`.
- **Dev toolbar** disabled.

## Two sharp edges the factory papers over

**SEO plugin entrypoint patching.** SEO 0.12's descriptor paths are stripped by EmDash 1.4's `definePlugin`, so the factory re-points `entrypoint`/`adminEntry` at the installed package's `src/index.ts` / `src/admin.tsx` resolved against `appRootUrl` (`import.meta.url` of the caller's config). This is why `appRootUrl` is required: plugin assets must resolve inside *each app's* `node_modules`.

**Worker entrypoint.** `packages/astro-config/worker.ts` re-exports Astro's Cloudflare server handler as the default and `PluginBridge` from `@emdash-cms/cloudflare/sandbox`; both apps' `src/worker.ts` re-export it as `@jamesryan/astro-config/worker`, keeping the `LOADER` sandbox bridge identical everywhere.
