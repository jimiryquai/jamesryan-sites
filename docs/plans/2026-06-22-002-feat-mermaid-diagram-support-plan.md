---
title: Mermaid Diagram Support in Code Block Pro
type: feat
status: active
date: 2026-06-22
---

# Mermaid Diagram Support in Code Block Pro

## Overview
This plan designs native support for rendering interactive vector diagrams (flowcharts, sequence diagrams, architectures) inside the existing `emdash-plugin-code-block-pro` package. Users will be able to write standard Mermaid.js syntax inside a code block, select the `mermaid` language in the editor, and have the site automatically render it client-side.

## Technical Considerations
1. **On-Demand Script Loading:** To preserve page speed and avoid bloat, the Mermaid.js rendering script will be loaded dynamically from a CDN *only* if a code block with language `mermaid` is present on the page.
2. **Resilient Error Handling:** Invalid Mermaid syntax must be caught gracefully client-side so it does not freeze page rendering or throw uncaught execution errors in the console. 
3. **Theme & Dark Mode Integration:** Mermaid diagrams must dynamically adapt to dark/light theme changes. We will inject system/document theme classes directly into the initialization configurations.
4. **Copy & Text Fallback:** Copy button actions inside `CodeBlockPro` will still function to let users easily copy the raw Mermaid source syntax.

---

## Proposed Changes

### [Component] emdash-plugin-code-block-pro

#### [MODIFY] [CodeBlockPro.astro](file:///home/james/Repos/oatmeal-olive-instrument/packages/emdash-plugin-code-block-pro/src/astro/CodeBlockPro.astro)
Update `CodeBlockPro.astro` to detect if the block language is `mermaid`.
* If `language === 'mermaid'`, bypass the Shiki syntax highlighting engine to avoid useless HTML token wrapping.
* Render a wrapper container `<div class="cbp-mermaid-container font-sans text-center">` containing the raw code string inside a `<div class="mermaid">` element.
* Append a client-side script block that:
  1. Dynamically imports `mermaid` from a CDN ESM module (`https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs`).
  2. Detects the current page theme state (checking for `dark` class on the `<html>` root or matching `prefers-color-scheme`).
  3. Initializes Mermaid with custom variables to match our core brand palette (`--color-primary` as indigo `#6366f1` and `--color-accent` as pink `#f472b6`).
  4. Runs `mermaid.run()` to translate text graphs to interactive SVG vectors.

---

## Acceptance Criteria
- [ ] Code blocks with `language === "mermaid"` are rendered as live vector diagrams.
- [ ] Diagrams dynamically adapt to dark mode (using `dark` theme variables) and light mode (using `neutral`/`default` themes).
- [ ] Bypasses Shiki compiler when rendering Mermaid, ensuring execution speed is fast.
- [ ] If syntax errors exist inside a Mermaid block, they are caught gracefully and a clean error message is shown instead of crashing.
- [ ] If no Mermaid diagram is present on the current page, the `mermaid.js` library is never requested/loaded.

---

## Implementation Units

### Unit 1: Template and Layout Detection
* Update the destructuring parameters in [CodeBlockPro.astro](file:///home/james/Repos/oatmeal-olive-instrument/packages/emdash-plugin-code-block-pro/src/astro/CodeBlockPro.astro) to declare `isMermaid`.
* Condition the container UI structure: if `isMermaid` is true, omit line-numbering and formatting, rendering instead a container structure that aligns with the visual character rules.

### Unit 2: Client-side Script Integration
* Insert a `<script type="module">` tag at the bottom of the component.
* Implement dynamic module imports to fetch `mermaid`.
* Add custom color mapping based on Tailwind CSS/base styles.
