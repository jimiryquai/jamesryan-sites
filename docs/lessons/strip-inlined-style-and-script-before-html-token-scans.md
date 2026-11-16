---
type: Lesson
title: Strip style and script blocks before scanning SSR HTML for retired markup tokens
description: With Astro build.inlineStylesheets set to always, route stylesheets inline into every HTML response including /404, so substring checks for retired classes or CSS custom properties must strip <style> and <script> blocks first.
tags: [astro, testing, css, performance]
generated: { by: agy/gemini-4-carbon, at: 2026-11-16T14:07:00Z }
sources:
  - id: ticket
    resource: .scratch/perf/issues/02-723e0f18-inline-astro-stylesheets-and-complete-lcp-image-preloads-and.md
  - id: fixture
    resource: scripts/seo-fixture.mjs
---

# Context
Enabling `build: { inlineStylesheets: "always" }` in `packages/astro-config/index.mjs` eliminated render-blocking `/_astro/*.css` network hops across `marketing-site` and `digital-garden`, but caused `verifyNotFound` in `scripts/seo-fixture.mjs` to fail on `digital-garden` `/404` because `digital-garden/src/styles/globals.css` still defines legacy CSS variables (`--color-primary`, `--spacing-`) for unmigrated pages, which were now inlined inside `<style>` on every SSR HTML response rather than served from an external stylesheet.[^ticket][^fixture]

# Lesson
When asserting that rendered SSR HTML omits retired theme class names or CSS variable substrings under `inlineStylesheets: "always"`, strip `<style>` and `<script>` blocks from the HTML string before scanning document markup.[^fixture]

# How to apply
- Strip `<style\b[^>]*>[\s\S]*?<\/style>` and `<script\b[^>]*>[\s\S]*?<\/script>` before running substring assertions on rendered HTML markup (as `verifyNotFound` in `scripts/seo-fixture.mjs` does).
- Keep stylesheet-level token assertions in dedicated CSS tests rather than mixing them into document-markup checks.

[^ticket]: Ticket `02-723e0f18` (`02-inline-css-lcp`, merged in PR #53 `b397275`)
[^fixture]: `scripts/seo-fixture.mjs` (`verifyNotFound`)
