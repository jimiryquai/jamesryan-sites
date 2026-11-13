# Files

- [Discovery endpoints](discovery-endpoints.md) - The machine-facing surface both apps share — rss.xml, llms.txt, sitemap.xml, schema endpoints and schemamap/api-catalog, robots.txt, and taxonomy archives — all published-only with session-aware caching.
- [OpenGraph image routes](opengraph-images.md) - The /og/* PNG routes both apps share — workers-og Satori cards with embedded Inter fonts, published-entry gating for anonymous requests, session-aware cache headers, and bounded caching.
- [Published-route boundary](published-route-boundary.md) - The anonymous published-only rule for CMS content — one request-authorized lookup for rendering, a published-only map for discovery, URL mapping and its inverse, and how preview/edit-mode isolation works.
- [Usermaven analytics proxy](usermaven-proxy.md) - The marketing-only /s1/* Usermaven proxy — first-party script and event forwarding with strict header filtering, bounded bodies, key gating, and no shared caching.
