---
type: Lesson
title: Cookie-forced theme tests mask broken cookie-less System dark mode
description: Setting Cookie theme=light|dark in Playwright skips the default System theme state where <html> has neither .light nor .dark, hiding scoped :global(.dark) CSS bugs on dark OSes.
tags: [accessibility, theming, testing, css]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T18:52:00Z }
sources:
  - id: ticket
    resource: .scratch/baseline/issues/30-96529855-fix-system-dark-mode-on-post-and-search-pages-and-cover-syst.md
  - id: theme-init
    resource: packages/ui/src/components/theme-init.js
  - id: browser-helper
    resource: scripts/accessibility-browser.mjs
---

# Context
`packages/ui/src/components/theme-init.js` adds `.light` or `.dark` to `<html>` only when an explicit `theme` cookie is set; under the default `System` preference (every first-time or cookie-less visitor), `<html>` has neither class and relies on `color-scheme: light dark` plus Tailwind's `@custom-variant dark` (`:root:not(.light)` inside `@media (prefers-color-scheme: dark)`).[^theme-init] Because `scripts/accessibility-browser.mjs` always injected `Cookie: theme=light` or `Cookie: theme=dark`, CI passed even while scoped `<style>` blocks on `posts/[slug].astro` and `search.astro` gated dark rules on `:global(.dark)`, leaving dark `--color-olive-800` / `--color-olive-950` text unreadable against `#0c0c09` on dark OSes.[^ticket][^browser-helper]

# Lesson
Never rely solely on explicit `.light` / `.dark` class toggles when authoring scoped CSS or running browser contrast checks in a three-state (`Light` / `Dark` / `System`) theme architecture.[^ticket]

# How to apply
- Prefer Tailwind `dark:` utilities, `light-dark(...)`, or CSS custom properties that already adapt to `color-scheme: light dark` over custom `<style>` overrides.
- If a scoped `<style>` block must branch on dark mode, cover both `.dark` and `@media (prefers-color-scheme: dark) { :root:not(.light) ... }` rather than `:global(.dark)` alone.
- In Playwright accessibility and contrast suites (`scripts/accessibility-browser.mjs`), exercise cookie-less `colorScheme: 'dark'` alongside explicit `theme=light` and `theme=dark`.[^browser-helper]

[^ticket]: Ticket 30 (`30-96529855`, filed during Ticket 13 codebase review)
[^theme-init]: `packages/ui/src/components/theme-init.js`
[^browser-helper]: `scripts/accessibility-browser.mjs`
