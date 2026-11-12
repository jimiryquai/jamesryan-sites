---
name: emdash-mcp
description: Manage and query the local Astro/EmDash CMS database (marketing-site on port 4321, digital-garden on port 4322) via MCP tools. Use when you need to list, read, draft, edit, publish, or delete posts, pages, menus, taxonomies, or media items.
---

# EmDash MCP Skill

You can interact directly with the local Astro/EmDash CMS databases for both sites in this monorepo using their respective MCP servers:
* **`emdash-marketing`** (runs on port `4321`)
* **`emdash-garden`** (runs on port `4322`)

The tools are exposed natively to your environment. Do **not** run shell commands (`npx mcporter`) to call them. Call the functions directly from your tool panel.

## Native Tools & Usage

### 1. Content Operations (`pages`, `posts`, etc.)
* **`content_list(collection: string, status?: "draft" | "published" | "scheduled", limit?: number, cursor?: string)`**:
  List entries in a collection.
  *Example*: `content_list(collection: "pages")`
* **`content_get(collection: string, id: string)`**:
  Retrieve a specific entry by its database ID (ULID).
  *Example*: `content_get(collection: "pages", id: "01PARENT123")`
* **`content_create(collection: string, data: Record<string, any>, slug?: string, status?: "draft" | "published")`**:
  Create a new page or post draft.
  *Example*: `content_create(collection: "pages", data: {"title": "New Page", "content": []}, status: "draft")`
* **`content_update(collection: string, id: string, data: Record<string, any>, slug?: string, status?: "draft" | "published")`**:
  Update an existing draft or published entry.
  *Example*: `content_update(collection: "pages", id: "01PARENT123", data: {"title": "Updated Title"})`
* **`content_delete(collection: string, id: string)`**:
  Permanently delete an entry.
  *Example*: `content_delete(collection: "pages", id: "01PARENT123")`

### 2. Menu Operations
* **`menu_list()`**:
  List all navigation menus.
* **`menu_set_items(menuName: string, items: Array<any>)`**:
  Update the items of a menu (e.g. `primary`, `footer_product`).
  *Example*: `menu_set_items(menuName: "primary", items: [{"label": "Home", "url": "/"}, {"label": "Blog", "url": "/blog"}])`

### 3. Taxonomy Operations
* **`taxonomy_list_terms(taxonomy: string)`**:
  List terms in a taxonomy (e.g. `category` or `post_tag`).
* **`taxonomy_create_term(taxonomy: string, slug: string, label: string)`**:
  Create a new term in a taxonomy.
  *Example*: `taxonomy_create_term(taxonomy: "category", slug: "tutorials", label: "Tutorials")`

### 4. Media Operations
* **`media_list()`**:
  List files in the media library.
* **`media_create(data: Record<string, any>)`**:
  Register a file upload as a media item.
  *Example*: `media_create(data: {"src": "/uploads/my-image.png", "alt": "Description"})`

## Roles and Constraints
* Call `schema_list_collections()` or `schema_get(collection: string)` to check the fields and types on a collection before editing or creating content.
