---
title: Fix Frontend Rendering of Code Block Pro Plugin
type: fix
status: active
date: 2026-05-22
---

# Fix Frontend Rendering of Code Block Pro Plugin

## Overview

The Code Block Pro EmDash plugin registers correctly in the admin and saves data, but the frontend rendering component (`CodeBlockPro.astro`) renders broken — **black background, no syntax highlighting, code on one line**. This plan identifies the root causes and prescribes specific fixes.

## Investigation Summary

### Data Flow (Confirmed Working)

The data pipeline has been traced end-to-end through EmDash's source:

1. **Admin Editor** (`@emdash-cms/admin`): Block Kit form captures fields keyed by `action_id` → `values = { code, language, theme, filename, lineNumbers, lineHighlights, copyButton, maxHeight }`
2. **ProseMirror Storage**: Admin stores plugin blocks as `pluginBlock` nodes with `{ blockType, id, data }` attrs, where `data = { code, language, theme, ... }`
3. **Portable Text Conversion**: `pmToPortableText()` in both `InlinePortableTextEditor.tsx` and admin's `PortableTextEditor.tsx` spreads `data` back to top-level keys: `{ _type: "code-block-pro", _key: "...", id: "", code: "...", language: "typescript", ... }`
4. **Frontend Rendering**: `astro-portabletext` passes the raw PT block as `node` prop → `CodeBlockPro.astro` destructures `node.code`, `node.language`, etc.

**Conclusion: The data shape is correct.** The `CodeBlockProNode` interface matches the actual PT block structure. The keys ARE at top level as expected.

### Root Causes Identified

#### RC-1: Shiki `createJavaScriptRegexEngine` import path mismatch (HIGH)

**File:** `src/utils/highlighter.ts:2`

```typescript
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
```

`@shikijs/engine-javascript` is **not listed as a dependency or peerDependency** in the plugin's `package.json`. It happens to be available in the blog's `node_modules` because Shiki v4 bundles it, but the import relies on the hoisted dependency resolution of the host site. If the blog uses a different Shiki version or package manager, this import will fail silently (or throw at build time).

Additionally, the `highlighter.ts` file imports from the **bare specifier** `@shikijs/engine-javascript`, which only works if the host has it installed. Since this is a plugin that runs inside the host's Vite process, this is acceptable BUT should be documented as a hard requirement.

**Impact:** If the import fails, `getHighlighter()` throws, `highlightCode()` throws, and the component renders nothing (or crashes). This is the most likely cause of "black background, no highlighting."

#### RC-2: Missing `@shikijs/engine-javascript` in peerDependencies (MEDIUM)

**File:** `package.json`

The plugin lists `shiki` as a peerDependency but does NOT list `@shikijs/engine-javascript`. The highlighter code directly imports from `@shikijs/engine-javascript`, so it should be a peerDependency too.

#### RC-3: No error boundary in the Astro component (HIGH)

**File:** `src/astro/CodeBlockPro.astro`

If `highlightCode()` throws (e.g., Shiki fails to import, unsupported language, theme not found), the entire component crashes with an unhandled error. There is no try/catch fallback to render raw code.

#### RC-4: Descriptor test checks `f.name` instead of `f.action_id` (LOW)

**File:** `src/__tests__/descriptor.test.ts`

The test does `block.fields.find((f: any) => f.name === "code")` but Block Kit fields use `action_id`, not `name`. This means the test would find `undefined` for every field check. The test can't actually run anyway (no `astro` package in plugin's dependencies), but if it could, it would fail.

#### RC-5: Unbuilt source exports may cause issues (LOW)

**File:** `package.json` → `exports`

The exports point to raw `.ts`, `.tsx`, and `.astro` source files. This works because Astro's Vite plugin handles on-the-fly compilation, but it means the plugin cannot be used without an Astro build pipeline. This is fine for EmDash plugins (they always run inside Astro), but the tests can't run standalone.

#### RC-6: The `CodeBlock.astro` component overrides EmDash's built-in `code` renderer (MEDIUM)

**File:** `src/astro/index.ts`

```typescript
export const blockComponents: Record<string, any> = {
    code: CodeBlock,           // <-- overrides EmDash's built-in code block
    "code-block-pro": CodeBlockPro,
};
```

The plugin registers a `code` component that overrides EmDash's built-in `Code.astro`. This means ALL code blocks (not just `code-block-pro` ones) will use the plugin's `CodeBlock.astro`. The `CodeBlock.astro` component expects `node.code` which is the correct key for EmDash's built-in `_type: "code"` blocks. However, this override may cause unintended side effects if the user has existing code blocks that were rendered with EmDash's built-in `Code.astro`.

## Proposed Solution

### Fix 1: Add error handling to `CodeBlockPro.astro`

Wrap the Shiki highlighting call in a try/catch. On failure, fall back to rendering the raw code in a `<pre><code>` block with basic styling.

**File:** `src/astro/CodeBlockPro.astro`

```astro
// Replace direct call with error-bounded call
let highlightedHtml: string;
try {
    highlightedHtml = await highlightCode(codeForShiki, language || "text", theme || "github-dark");
} catch (err) {
    console.error("[code-block-pro] Shiki highlighting failed:", err);
    highlightedHtml = `<pre class="shiki" style="background-color:#24292e;color:#e1e4e8"><code>${escapeHtml(trimmedCode)}</code></pre>`;
}
```

Add a simple `escapeHtml` helper function in the frontmatter.

### Fix 2: Add `@shikijs/engine-javascript` as a peerDependency

**File:** `package.json`

```json
"peerDependencies": {
    "@shikijs/engine-javascript": "^4.0.0",
    "@types/react": "^18.0.0",
    "emdash": "^0.9.0",
    "react": "^18.0.0",
    "shiki": "^4.0.0"
}
```

### Fix 3: Fix the descriptor test to use `action_id`

**File:** `src/__tests__/descriptor.test.ts`

Change all `f.name === "..."` to `f.action_id === "..."` and add proper type imports.

### Fix 4: Consider removing the `code` key from blockComponents

**File:** `src/astro/index.ts`

Only register the `"code-block-pro"` component, not `code`. Let EmDash's built-in `Code.astro` handle standard code blocks. If the user wants the plugin's enhanced rendering for ALL code blocks, they can configure that explicitly.

```typescript
export const blockComponents: Record<string, any> = {
    "code-block-pro": CodeBlockPro,
};
```

**Alternative:** Keep the override but add a comment explaining the intent. This is a product decision.

## Technical Considerations

- **Vite caching**: After making changes to the plugin source, the blog's `.vite` cache must be cleared (`rm -rf node_modules/.vite` in the blog repo) because Vite aggressively caches linked packages.
- **Server rendering**: All content pages are server-rendered (`output: "server"`), so Shiki highlighting happens at build/request time, not in the browser. This means Shiki must be available in the server bundle.
- **Cloudflare Workers**: The plugin uses `@shikijs/engine-javascript` specifically to avoid WASM, which is incompatible with Cloudflare Workers (workerd). This is the correct choice.
- **Astro component scope**: The `is:global` CSS approach is necessary because Shiki HTML is injected via `set:html` and won't receive Astro's scoped data attributes.

## Acceptance Criteria

- [ ] `CodeBlockPro.astro` renders syntax-highlighted code with a Shiki theme
- [ ] If Shiki fails, the component falls back to a readable `<pre><code>` block (no white-screen crash)
- [ ] Line numbers render correctly when `lineNumbers: true`
- [ ] Line highlights render correctly with the `cbp-highlighted` class
- [ ] Copy button works (copies code to clipboard, shows checkmark)
- [ ] Filename header and language badge render when `filename` is set
- [ ] Max-height scroll container works when `maxHeight` is set
- [ ] The basic `CodeBlock.astro` renders EmDash's built-in `_type: "code"` blocks correctly
- [ ] `@shikijs/engine-javascript` is listed as a peerDependency
- [ ] Descriptor tests use `action_id` instead of `name`
- [ ] After plugin changes, clearing Vite cache in the blog repo causes the fixes to take effect

## Implementation Units

### Unit 1: Add error boundary to CodeBlockPro.astro
**Goal:** Prevent white-screen crashes when Shiki fails; provide graceful fallback
**Files:** `src/astro/CodeBlockPro.astro`

### Unit 2: Add error boundary to CodeBlock.astro
**Goal:** Same fallback treatment for the basic code block renderer
**Files:** `src/astro/CodeBlock.astro`

### Unit 3: Fix peerDependencies
**Goal:** Ensure `@shikijs/engine-javascript` is declared as a required peer
**Files:** `package.json`

### Unit 4: Fix descriptor tests
**Goal:** Tests check `action_id` instead of `name`
**Files:** `src/__tests__/descriptor.test.ts`

### Unit 5: Evaluate `code` component override
**Goal:** Decide whether to keep or remove the `code` key in `blockComponents`
**Files:** `src/astro/index.ts`

### Unit 6: Verify end-to-end in the blog
**Goal:** Build the blog, insert a code-block-pro block via admin, verify frontend renders correctly
**Files:** N/A (verification in `/home/james/Repos/astro-blog/`)

## Testing Approach

1. **Unit tests** (in plugin repo, requires `astro` as devDep):
   - Run `vitest` to verify component rendering tests pass
   - Verify descriptor tests pass with `action_id` fix

2. **Integration test** (in blog repo):
   ```bash
   cd /home/james/Repos/astro-blog
   rm -rf node_modules/.vite          # clear Vite cache
   pnpm dev                           # start dev server
   ```
   - Open admin, create a new post
   - Insert a "Code Block Pro" block via slash menu
   - Fill in code, language, theme, filename, enable line numbers, add line highlights
   - Save and publish
   - View the published post — verify syntax highlighting, line numbers, copy button, filename header
   - Check browser console for errors
   - Verify the rendered HTML contains `.cbp-wrapper`, `.shiki`, `.line` elements

3. **Error handling test**:
   - Temporarily break the Shiki import (rename the module)
   - Verify the component falls back to raw code rendering (no crash)

## Sources & References

- EmDash Portable Text rendering: `emdash/src/components/PortableText.astro` (line 22-36)
- EmDash admin PT↔PM conversion: `@emdash-cms/admin/dist/index.js` (lines 6281-6292, 6460-6485)
- EmDash inline editor PT↔PM conversion: `emdash/src/components/InlinePortableTextEditor.tsx` (lines 205-215, 432-441)
- astro-portabletext component props: `astro-portabletext/lib/types.ts` (`Props<N>` interface)
- Block Kit element types: `@emdash-cms/blocks/dist/validation-DZT28Klg.d.ts`
- Shiki JS engine: `@shikijs/engine-javascript` v4.0.2
