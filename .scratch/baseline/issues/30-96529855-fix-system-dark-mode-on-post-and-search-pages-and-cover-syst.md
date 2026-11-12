# 30-96529855: Fix system-dark mode on post and search pages and cover system theme in CI

**Spec:** docs/specs/baseline.md

**What to build:**

When a visitor uses the default `System` theme preference (no `theme` cookie), `packages/ui/src/components/theme-init.js:4-9` leaves `<html>` without `.dark` or `.light`, relying on `color-scheme: light dark` and Tailwind's `@custom-variant dark` (`packages/ui/src/styles/globals.css:5-10`). However, scoped `<style>` blocks on post and search pages hardcode `:global(.dark)` instead of honoring `:root:not(.light)` under `@media (prefers-color-scheme: dark)` (or `light-dark()`), and also contain invalid Tailwind slash-alpha CSS properties:

1. `apps/marketing-site/src/pages/posts/[slug].astro:373-551` and `apps/digital-garden/src/pages/posts/[slug].astro:371-549`: every dark-mode rule uses `:global(.dark)` (`lines 373, 389, 402, 414, 430, 442, 469, 477, 487, 513-514, 531, 542, 549`). Under default `System` preference on a dark OS, `<body>` turns `--color-olive-950` (`#0c0c09`) while `.article-content`, headings, links, inline code, and `.ec-comment-form-field input, textarea` keep dark light-mode colors (`--color-olive-800` / `--color-olive-950 !important`), failing WCAG contrast completely.
2. `apps/marketing-site/src/pages/posts/[slug].astro:409,416,422-423,431-432,437,443,467,470,475,478` (and matching lines in `apps/digital-garden/src/pages/posts/[slug].astro`): raw CSS declarations use invalid Tailwind slash-opacity syntax (`background: var(--color-olive-950)/2.5`, `background: white/5`, `border-top: 1px solid var(--color-olive-950)/10`), which browsers drop as invalid CSS (rendering `<hr>` invisible because `border: none` at line `474` succeeds while `border-top` at line `475` is dropped). Replace with valid `color-mix(in srgb, ...)` or CSS custom properties.
3. `apps/marketing-site/src/pages/search.astro:27,61,76` and `apps/digital-garden/src/pages/search.astro:27,61,76,82`: `<p set:html={result.snippet} />` at line `61` omits `class="result-snippet"` so `.result-snippet :global(mark)` (`line 76`) never applies, `digital-garden/src/pages/search.astro:82` uses `:global(.dark)`, and the search input (`line 27`) uses low-contrast `placeholder-olive-400` and `border-olive-950/10` (`< 3:1` input boundary).
4. `scripts/accessibility-browser.mjs:4-6`, `scripts/check-accessibility.mjs:33`, and `scripts/check-comment-fields.mjs:11-12`: `openAccessibilityPage` always sets `Cookie: theme=light|dark`, so cookie-less `System` dark mode (`colorScheme: 'dark'` with no `theme` cookie) was never exercised in CI. Extend the browser accessibility and comment-field checks to verify `system-dark` (cookie-less `colorScheme: 'dark'`) on `/posts/<slug>` and `/search`.

**Blocked by:** none.

**Status:** needs-triage

- [ ] `/posts/<slug>` body copy, headings, links, blockquotes, code blocks, `<hr>`, and comment form fields pass WCAG 2.2 AA contrast in light, explicit `.dark`, and cookie-less `System` dark (`prefers-color-scheme: dark`) modes.
- [ ] Zero invalid `var(...)/N` or `white/N` raw CSS declarations remain in `.astro` `<style>` blocks.
- [ ] `/search` applies `.result-snippet` highlight styles and meets 3:1 input border and 4.5:1 placeholder/text contrast in light, explicit dark, and system-dark modes.
- [ ] `scripts/check-accessibility.mjs` and `scripts/check-comment-fields.mjs` exercise cookie-less `colorScheme: 'dark'` so regressions in `:global(.dark)` selectors fail CI.

## Comments
