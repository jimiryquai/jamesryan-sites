# Posts archive description

Use the Posts collection's existing `description`, read through
`getCollectionInfo("posts")`, for `/posts` metadata. James fills it in Content
Types → Posts; the site tagline remains the fallback while it is unset.

Sources: EmDash's [SEO guide](https://docs.emdashcms.com/guides/seo/) describes
entry SEO and custom page contexts. The installed `emdash` 1.4 API exposes
`Collection.description` and `getCollectionInfo`; `getSeoMeta` accepts entries,
so the archive reads the collection description directly.
