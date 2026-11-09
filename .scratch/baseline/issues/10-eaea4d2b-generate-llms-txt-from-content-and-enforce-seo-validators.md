# 10-eaea4d2b: Generate llms.txt from content and enforce SEO validators

**Spec:** docs/specs/baseline.md

**What to build:**

Replace the hand-written `llmsTxt.sections` in `apps/marketing-site/astro.config.mjs` with values derived from the site's published pages and posts at request or build time (whatever astro-seo-graph 2.2 supports; check its docs). Remove the stale `/pricing` entry. Remove the `seoPlugin()` `entrypoint`/`adminEntry` override if 0.12 resolves correctly without it. Make sure the astro-seo-graph validators (H1, unique metadata, image alt, metadata length, internal links) fail the build or the staging smoke job. Do the same for the garden.

**Blocked by:** 05-10cd2eae.

**Status:** done

- [x] `llms.txt` on staging lists only pages and posts that exist.
- [x] The override is gone, or a comment explains why it must stay.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: medium (no docs/agents/review.md; build-time SEO generation and CI-enforced validators).

**2026-11-08 Claude (orchestrator):** Validator enforcement moved to 17-caadd917 (the package's validators only scan static HTML and both apps are SSR), along with its acceptance box "A page with a missing H1 or image alt fails CI (proved on a throwaway branch)". This ticket keeps `llms.txt` and the SEO override.

**2026-11-08 Claude (orchestrator):** Built by h10-copilot (Copilot, GPT-6.1 Terra), PR #13 (cde0191, d93b177) merged into `baseline`; CI green on d93b177; merged-tree checks pass. `llms.txt` is now a request-time route in both apps (`src/pages/llms.txt.ts` → `@jamesryan/cms-helpers` `getLlmsTxt`): site title and tagline from EmDash settings, every published page and post (all result pages, drafts excluded, cache hints set), via `renderLlmsTxt` from astro-seo-graph 2.2. The hand-written `llmsTxt` config (and its stale `/pricing` link) is gone. Fix round 1: URLs now come from one shared map (`getContentPath`) that both sitemaps and `llms.txt` use, so home is `/` and about is `/about` (live check locally: marketing 10 links, garden 6, each 200 and matching its sitemap path and canonical tag). The SEO `entrypoint`/`adminEntry` override stays: both builds fail without it on EmDash 1.4 (`Plugin "seo" has no entrypoint`), and the config comment says so. Validator enforcement moved to 17-caadd917. For ticket 13: marketing `/about` and garden `/` render hard-coded Astro pages, not their CMS entries, and `getContentPath` hard-codes which page slugs are top-level. Evidence: `.orchestrate/runs/2026-11-08-10-llms-txt-validators/`.

**2026-11-09 Claude (orchestrator):** Done. After Deploy run 42603619880, both staging `llms.txt` files list 10 URLs between them (jamesryan.dev's 4 pages and 2 posts; the garden's home and pages), and all 10 return 200.
