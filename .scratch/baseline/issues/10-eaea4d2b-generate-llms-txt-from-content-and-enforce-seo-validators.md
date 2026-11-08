# 10-eaea4d2b: Generate llms.txt from content and enforce SEO validators

**Spec:** docs/specs/baseline.md

**What to build:**

Replace the hand-written `llmsTxt.sections` in `apps/marketing-site/astro.config.mjs` with values derived from the site's published pages and posts at request or build time (whatever astro-seo-graph 2.2 supports; check its docs). Remove the stale `/pricing` entry. Remove the `seoPlugin()` `entrypoint`/`adminEntry` override if 0.12 resolves correctly without it. Make sure the astro-seo-graph validators (H1, unique metadata, image alt, metadata length, internal links) fail the build or the staging smoke job. Do the same for the garden.

**Blocked by:** 05-10cd2eae.

**Status:** in progress

- [ ] `llms.txt` on staging lists only pages and posts that exist.
- [ ] The override is gone, or a comment explains why it must stay.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: medium (no docs/agents/review.md; build-time SEO generation and CI-enforced validators).

**2026-11-08 Claude (orchestrator):** Validator enforcement moved to 17-caadd917 (the package's validators only scan static HTML and both apps are SSR), along with its acceptance box "A page with a missing H1 or image alt fails CI (proved on a throwaway branch)". This ticket keeps `llms.txt` and the SEO override.
