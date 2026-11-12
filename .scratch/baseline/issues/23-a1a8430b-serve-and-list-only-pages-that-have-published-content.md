# 23-a1a8430b: Serve and list only pages that have published content

**Spec:** docs/specs/baseline.md

**What to build:**

Found 2026-11-09. jamesryan.dev serves and advertises template pages that James never launched (James: "None of those pages are live"):
- the sitemap lists `/contact`, `/privacy-policy`, `/pricing` and `/projects`, and `robots.txt` allows them;
- all four answer 200;
- `/pricing` shows "Add pricing content in the admin.", `/privacy-policy` is template boilerplate for "Company Inc.", `/contact` is the theme's "Talk to our team" form, and `/projects` is an empty "Selected Work" listing.

Where they come from:
- `apps/marketing-site/src/pages/sitemap.xml.ts` lists every published `pages` entry and hard-codes `/projects`;
- the dedicated routes (`contact.astro`, `pricing.astro`, `privacy-policy.astro`, `projects/index.astro`) render whatever exists, empty states included;
- `getContentPath` in `packages/cms-helpers/src/content-url.ts` maps those slugs to top-level paths.

The rule, one source of truth: **a page exists on the site only when it has published content.**
1. Each dedicated route returns 404 when its CMS entry is missing or unpublished, and `/projects` returns 404 when there are no published projects. A missing entry never falls back to template copy (contact's form, pricing's empty state, privacy's boilerplate).
2. The sitemap and `llms.txt` list exactly the routes that would return 200. `/projects` is listed only when published projects exist, derived from the same query rather than a hard-coded line. Keep one helper that both the routes and the sitemap ask, so they can't disagree.
3. Tests: with an entry unpublished, its route returns 404 and is absent from the sitemap and `llms.txt`; published, it's present and returns 200. Extend the rendered check's fixture so CI covers both cases.

Marketing site first; the garden shares the pattern, but is out of scope.

**Blocked by:** none.

**Status:** in progress

- [ ] An unpublished or missing page's route returns 404 and is absent from the sitemap and `llms.txt`; `/projects` appears only when published projects exist (tests, and the rendered check in CI).
- [ ] On staging after deploy, the sitemap lists only routes that return 200 (output in a comment).

## Comments

**2026-11-09 Claude (orchestrator):** Raised from James's note while drafting ticket 18's SEO. Immediate mitigation, through MCP with James's approval: unpublish the Pricing, Privacy Policy and Contact entries on production, which removes them from the sitemap without a deploy. Risk: medium (routing and the sitemap on the live site).

**2026-11-09 Claude (orchestrator):** Mitigation applied on production: Pricing and Privacy Policy are unpublished and out of the sitemap, but their routes still answer 200 with template fallbacks. There's no Contact page entry on production: `/contact` and `/projects` are in the sitemap from code. Also in scope: the `/posts` listing's description is the site tagline; give listing pages a description source, or record that EmDash has none.

**2026-11-12 Claude (orchestrator):** Claimed for h23-codex (Codex, GPT-6.1 Sol), base `master`. Risk: medium (routing and the sitemap on the live site; no auth or CI changes).
