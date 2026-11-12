# Posts listing description

The marketing site's `/posts` meta description reads the Posts collection's
`description` through EmDash's `getCollectionInfo("posts")`. James should fill
that description in Content Types → Posts. It is currently unset; until it is
filled, the existing site tagline remains the fallback. No new copy was added.

Verified against EmDash 1.4.0 on 2026-11-12:

- Live documentation searched through `pnpm exec mcporter call emdash-docs.search_docs`:
  [Built-in SEO](https://docs.emdashcms.com/guides/seo/) describes entry SEO and
  custom page contexts; it does not provide an archive SEO panel.
- The installed `emdash/dist/types-BuvSwT9Y.d.mts`, `Collection`, declares
  `description?: string` separately from entry SEO support (`hasSeo`).
- The installed `emdash/dist/config-sDhZvkLR.d.mts`, `src/schema/query.d.ts`,
  exports `getCollectionInfo(slug): Promise<Collection | null>`.
- The installed `emdash/dist/seo/index.d.mts` accepts content entries for
  `getSeoMeta`, rather than collections. The collection description is therefore
  read directly for this listing, without inventing a second settings source.

The rendered SEO fixture supplies a collection description and checks that it
wins over the site tagline. This fixture text is test data only.
