# Published routes

A marketing content route exists only when its CMS entry is published. The
Posts and Work archives exist only when their collections contain published
entries. Missing or unpublished content uses Astro's 404 rewrite.

`packages/cms-helpers/src/published-routes.ts` owns the rule. Rendering calls
`getPublishedRoute` for one targeted, SEO-hydrated lookup; sitemap.xml and
llms.txt use `getPublishedRoutes` for the full map. URL mapping and its inverse
live together in `content-url.ts`.

Category, tag and search discovery policy is out of scope for ticket 23. Their
absence from this content map does not change whether those routes can render.
The garden retains its previous discovery behavior through `getGardenLlmsTxt`
until its backlog item is implemented.

For the Posts archive's metadata source, see [Posts description](posts-description.md).
