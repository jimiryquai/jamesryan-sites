---
type: Lesson
title: Place Tailwind v4 @variant dark rules after equal-specificity light rules
description: Because @custom-variant dark expands with zero-specificity :where(.dark, .dark *), @variant dark blocks placed above light-mode rules lose the CSS cascade in both .dark and system-dark modes.
tags: [accessibility, tailwind, css, dark-mode]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T20:20:00Z }
sources:
  - id: ticket
    resource: .scratch/baseline/issues/33-2cbc0092-restore-markdown-endpoint-block-parity-and-fix-posts-404-and.md
  - id: globals-css
    resource: packages/ui/src/styles/globals.css
---

# Context
In `packages/ui/src/styles/globals.css`, `@custom-variant dark` is defined using `:where(.dark, .dark *)` and `@media (prefers-color-scheme: dark) { &:where(:root:not(.light), :root:not(.light) *) }` so utility classes keep low specificity.[^globals-css] During Ticket 33's Fix Round 1, `@variant dark { ... }` inside `.project-prose` was placed at the top of the `.project-prose` section, *above* `.project-prose :where(h1)`..`:where(hr)`. Because `:where(...)` adds `(0, 0, 0)` specificity (and `@media` adds none), both the dark and light rules compiled to `(0, 1, 0)` specificity, and the later light-mode `color: var(--color-olive-950)` rules overwrote the dark-mode rules — rendering `#0c0c09` text on a `#0c0c09` dark background (`1.00:1`).[^ticket]

# Lesson
When authoring component CSS with Tailwind v4's `:where(...)`-based `@custom-variant dark`, always place `@variant dark { ... }` **after** all corresponding light-mode rules of the same specificity, and verify computed colors in headless Chromium.[^ticket]

# How to apply
- Declare base/light rules first inside `@layer components` (or inside a parent selector), and place `@variant dark { ... }` at the bottom of that component block so dark rules win by source order.
- Never rely solely on CSS substring checks (`includes("prefers-color-scheme:dark")`) in build output; verify computed foreground/background contrast in a real browser under `light`, `.dark`, and cookie-less `system-dark`.

[^ticket]: Ticket 33 (`33-2cbc0092`, PR #41 Fix Round 1 cross-family review)
[^globals-css]: `packages/ui/src/styles/globals.css`
