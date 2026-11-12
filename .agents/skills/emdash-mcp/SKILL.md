---
name: emdash-mcp
description: Manage and query an EmDash CMS instance via its Streamable HTTP MCP tools (content, menus, taxonomies, media, and schema). Use when listing, reading, drafting, editing, or inspecting EmDash collections, menus, taxonomies, or media through MCP.
---

# EmDash MCP

EmDash exposes a stateless Streamable HTTP MCP server at `/_emdash/api/mcp` authenticated with scoped API tokens.

## Workflow

1. **Resolve the target server and credentials:** Read the project's MCP and publishing documentation to select the configured server and authentication workflow, and run any required token-scope preflight before mutating content. Done when the target server lists its available tools cleanly.
2. **Inspect the schema before writing:** Call `schema_list_collections` or `schema_get_collection` when your token includes `schema:read`, or read the project's `seed.json` when using a Contributor token without `schema:read`. Done when every target field slug and type is verified.
3. **Read `_rev` before updating:** Call `content_get` to retrieve the entry's current `_rev` token before calling `content_update`, `content_publish`, `content_unpublish`, or `content_discard_draft`. Done when the mutation succeeds against the matching `_rev`.

## Core Tool Families

- **Content (`content_list`, `content_get`, `content_create`, `content_update`, `content_delete`):** Query entries by collection slug and status (`draft`, `published`, `scheduled`), fetch entries by ULID or slug, create drafts, or update fields with optimistic concurrency (`_rev`).
- **Schema (`schema_list_collections`, `schema_get_collection`):** Inspect collection definitions, field slugs, and validation rules when the token carries `schema:read`.
- **Menus (`menu_list`, `menu_set_items`):** Inspect navigation menus and update menu items by menu name.
- **Taxonomies (`taxonomy_list_terms`, `taxonomy_create_term`):** List and create terms using the exact taxonomy name defined in the schema.
- **Media (`media_list`, `media_upload`):** List uploaded assets or upload media with contextual `alt` text and record the returned `id`, `url`, `width`, and `height`.
