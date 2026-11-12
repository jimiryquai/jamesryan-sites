---
name: emdash-mcp
description: Query and draft EmDash posts, pages, menus, taxonomies, and media through mcporter. Use when listing, reading, or preparing a draft on emdash-site, emdash-garden, or emdash-staging-agent for a human to publish.
---

# EmDash MCP

Reach the site databases with mcporter. Server names, commands, tokens, and readiness checks are in [docs/mcp.md](../../../docs/mcp.md).

- Local marketing-site: `emdash-site` via `pnpm -s mcp:local`
- Local digital-garden: `emdash-garden` via `pnpm -s mcp:local`
- Staging drafts: `emdash-staging-agent` via `pnpm -s mcp:staging`

Prepare drafts only. Field rules, the token-owner preflight, and the handoff to a human publisher are in [docs/publishing.md](../../../docs/publishing.md). Any `emdash-staging-agent` write starts there.

## Names the calls use

- Page body field: `layout` (page-builder blocks).
- Post taxonomies: `category` and `tag`.
- Public post archive: `/posts`.

List local posts once [docs/mcp.md](../../../docs/mcp.md) says the dev server is ready:

```sh
pnpm -s mcp:local call emdash-site.content_list collection:posts
```

Create a page draft with `layout` and leave status unset. Post body, SEO, and media arguments stay in [docs/publishing.md](../../../docs/publishing.md).

```sh
pnpm -s mcp:local call emdash-site.content_create collection:pages slug:example 'data:{"title":"Example","layout":[]}'
```

Point a menu item at the post archive, and read taxonomy terms by their seed names:

```sh
pnpm -s mcp:local call emdash-site.menu_set_items menuName:primary 'items:[{"label":"Posts","url":"/posts"}]'
pnpm -s mcp:local call emdash-site.taxonomy_list_terms taxonomy:category
pnpm -s mcp:local call emdash-site.taxonomy_list_terms taxonomy:tag
```

Before a local write, call `schema_get` for that collection when the token includes schema read. The staging contributor token may not; follow [docs/publishing.md](../../../docs/publishing.md).
