# Published routes

For anonymous visitors, a marketing content route exists only when its CMS
entry is published. EmDash authorizes draft previews and edit-mode requests
through its request context; rendering trusts the entry it returns. Discovery
always remains published-only, including during preview requests. The
Posts and Work archives exist only when their collections contain published
entries. Missing or unpublished content uses Astro's 404 rewrite.

`packages/cms-helpers/src/published-routes.ts` owns the rule. Rendering calls
`getPublishedRoute` for one targeted, request-authorized, SEO-hydrated lookup; sitemap.xml and
llms.txt use `getPublishedRoutes` for the full map. URL mapping and its inverse
live together in `content-url.ts`. A route that renders referenced content
passes its reference selection (`references: { service: true }`) to the same
`getPublishedRoute` call, and reads it from `entry.references` — one entry read
per route, cache hint included.

Category, tag and search discovery policy is out of scope for ticket 23. Their
absence from this content map does not change whether those routes can render.
The garden retains its previous discovery behavior through `getGardenLlmsTxt`
until its backlog item is implemented.

The `/og/*` image routes follow the same rule: `@jamesryan/cms-helpers/og`
maps the `/og/<collection>/<slug>.png` prefixes Base.astro emits (posts,
projects, pages), renders published entries only for anonymous requests
(verified previews and edit mode render drafts with `private, no-store`), and
404s unknown prefixes, missing slugs and non-published entries with bounded
caching — never `immutable`.

For the Posts archive's metadata source, see [Posts description](posts-description.md).

EmDash 1.5 entry cache hints carry invalidation tags, including for previews;
they do not mark previews private themselves. Its preview middleware disables
Astro route caching (`cache.set(false)`) for any `_preview` parameter and sets
`Cache-Control: private, no-store` for verified previews. The rendered fixture
checks this header and then repeats the anonymous request to verify isolation.
Checked against the installed EmDash 1.5 source on 2026-11-12.
Source: EmDash's [preview guide](https://docs.emdashcms.com/guides/preview/)
and installed `src/astro/middleware/request-context` / `src/query` / `src/loader` APIs.
