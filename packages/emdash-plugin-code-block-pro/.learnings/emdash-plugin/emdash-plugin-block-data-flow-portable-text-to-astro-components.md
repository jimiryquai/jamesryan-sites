---
module: emdash-plugin
problem_type: architecture
tags: ["emdash","portable-text","plugin-blocks","astro"]
---
### [2026-05-22] EmDash Plugin Block Data Flow: Portable Text to Astro Components
## EmDash Plugin Block Data Shape

When building EmDash plugins with custom Portable Text blocks (via `portableTextBlocks` in the plugin definition), the data flows as follows:

1. **Block Kit fields** use `action_id` as the key (e.g., `{ type: "text_input", action_id: "code" }`)
2. **Admin editor** stores values as `{ [action_id]: value }` in the ProseMirror node's `data` attr
3. **ProseMirror → Portable Text** conversion spreads `data` to top-level keys: `{ _type: "code-block-pro", code: "...", language: "typescript", ... }`
4. **astro-portabletext** passes the raw PT block as `node` prop to the component
5. **Astro component** receives `Astro.props.node` with all action_id fields as top-level keys

Key files in EmDash core:
- `src/components/PortableText.astro` — merges plugin block components
- `src/components/InlinePortableTextEditor.tsx` — inline visual editor PT↔PM conversion
- `src/astro/integration/virtual-modules.ts` — generates `virtual:emdash/block-components`
- Admin's `PortableTextEditor` — full admin editor PT↔PM conversion

The `componentsEntry` export must export `blockComponents: Record<string, AstroComponent>`, keyed by `_type` strings.

## Plugin registration

Plugin descriptors (returned by `codeBlockProPlugin()`) declare `componentsEntry` pointing to the module that exports `blockComponents`. EmDash's Vite integration generates a virtual module that imports and merges all plugin block components.

## Shiki in EmDash plugins

Use `@shikijs/engine-javascript` (not the default WASM engine) for Cloudflare Workers compatibility. Both `shiki` and `@shikijs/engine-javascript` must be available in the host site's `node_modules`.
