# Posts archive description

Use the Posts collection's existing `description`, read through
`getCollectionInfo("posts")`, for `/posts` metadata. James fills it in Content
Types → Posts; the site tagline remains the fallback while it is unset.

Sources: EmDash's [SEO guide](https://docs.emdashcms.com/guides/seo/) describes
entry SEO and custom page contexts. The installed `emdash` 1.5 API exposes
`Collection.description` and `getCollectionInfo`; `getSeoMeta` accepts entries,
so the archive reads the collection description directly. Checked on 2026-11-12
against `src/schema/types.ts`, `src/schema/query.ts` and `src/seo/index.ts`.
