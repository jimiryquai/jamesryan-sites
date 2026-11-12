# 33-2cbc0092: Restore Markdown endpoint block parity and fix /posts, /404 and /projects rendering bugs

**Spec:** docs/specs/baseline.md

**What to build:**

Fix five concrete rendering and agent-native parity defects in `apps/marketing-site` (and shared route equivalents):

1. **Agent-native Markdown block parity (`content-markdown.ts`):** `apps/marketing-site/src/utils/content-markdown.ts:71-123` (`portableTextToMarkdown`) only handles `block._type === "block"`, silently dropping `code-block-pro` / `code` blocks (losing fenced code snippets from technical blog posts and project pages) and `image` blocks (`![alt](url)`), and omitting `> ` prefixes when `block.style === "blockquote"` (`lines 82-86`). Update `portableTextToMarkdown` (and `prose` block rendering if shared) so agents fetching `/posts/<slug>.md`, `/projects/<slug>.md`, and `<page>.md` receive complete fenced code blocks, images, and blockquotes, and tighten `scripts/check-rendered-markdown.mjs:40-44,92-112` to assert code-block text on `.md` routes.
2. **Duplicate site-title suffix on `/posts`:** `apps/marketing-site/src/pages/posts/index.astro:79` passes `title={`Blog — ${siteTitle}`}` into `packages/ui/src/components/Base.astro:80` (`const fullTitle = title ? `${title} — ${siteTitle}` : siteTitle`), producing `<title>Blog — James Ryan — James Ryan</title>` whenever `siteTitle` is set. Pass `title="Blog"` (matching `apps/digital-garden/src/pages/posts/index.astro:77`).
3. **Broken `/404` stylesheet (`404.astro`):** `apps/marketing-site/src/pages/404.astro:15-16,21-90` (and `apps/digital-garden/src/pages/404.astro:15-16,21-90`) styles `.not-found` with retired template CSS variables (`--spacing-5xl`, `--spacing-lg`, `--max-width`, `--color-primary`, `--color-accent`, `--font-size-3xl`, `--radius`) and `.btn .btn-primary .btn-lg` classes that no longer exist in the Olive Tailwind v4 design system. Restyle `/404` with `@jamesryan/ui` components and olive tokens.
4. **Unstyled `/projects/[slug]` prose & phantom `gallery` field:** `apps/marketing-site/src/pages/projects/[slug].astro:45-47,138,144-159` (and `apps/digital-garden/src/pages/projects/[slug].astro:41-43,138,144-159`) applies `prose prose-olive dark:prose-invert` even though `@tailwindcss/typography` is not installed in the workspace (leaving Portable Text paragraphs/headings/lists unstyled), and reads `project.data.gallery`, which does not exist in `seed.json`'s `projects` collection schema. Share article Portable Text typography styles and remove or define `gallery`.
5. **Duplicated page-URL logic in verification scripts:** `scripts/check-rendered-markdown.mjs:19-24` redefines `TOP_LEVEL_PAGES` and `scripts/check-rendered-media.mjs:23` computes `/${entry.slug}` for all pages instead of `/pages/${entry.slug}` for non-top-level pages. Import `getContentPath` from `@jamesryan/cms-helpers` in both scripts.

**Blocked by:** none.

**Status:** needs-triage

- [ ] `/posts/<slug>.md` and `/projects/<slug>.md` include fenced `code-block-pro` code blocks (with language tag), `> ` blockquotes, and Markdown images, verified by `scripts/check-rendered-markdown.mjs`.
- [ ] `/posts` renders `<title>Blog — <siteTitle></title>` without repeating `<siteTitle>`.
- [ ] `/404` renders styled typography and action buttons using `@jamesryan/ui` olive classes with zero references to removed `--spacing-*`, `--font-size-*`, `--max-width`, `--radius`, or `.btn*` selectors.
- [ ] `/projects/<slug>` Portable Text body has explicit olive typography styling in light, explicit dark, and system-dark modes without relying on uninstalled `@tailwindcss/typography`, and `check-rendered-markdown.mjs` + `check-rendered-media.mjs` derive page paths from `@jamesryan/cms-helpers`.

## Comments
