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

**Status:** done

- [x] An unpublished or missing page's route returns 404 and is absent from the sitemap and `llms.txt`; `/projects` appears only when published projects exist (tests, and the rendered check in CI).
- [x] On staging after deploy, the sitemap lists only routes that return 200 (output in a comment).

## Comments

**2026-11-09 Claude (orchestrator):** Raised from James's note while drafting ticket 18's SEO. Immediate mitigation, through MCP with James's approval: unpublish the Pricing, Privacy Policy and Contact entries on production, which removes them from the sitemap without a deploy. Risk: medium (routing and the sitemap on the live site).

**2026-11-09 Claude (orchestrator):** Mitigation applied on production: Pricing and Privacy Policy are unpublished and out of the sitemap, but their routes still answer 200 with template fallbacks. There's no Contact page entry on production: `/contact` and `/projects` are in the sitemap from code. Also in scope: the `/posts` listing's description is the site tagline; give listing pages a description source, or record that EmDash has none.

**2026-11-12 Claude (orchestrator):** Claimed for h23-codex (Codex, GPT-6.1 Sol), base `master`. Risk: medium (routing and the sitemap on the live site; no auth or CI changes).

**2026-11-12 Claude (orchestrator):** Done. Built by h23-codex (Codex, GPT-6.1 Sol) with 2 fix rounds, PR #23, merged to master as 2927792. Commits: 6736936, 26231c1, 207bf4e, 2b833e4.
- `packages/cms-helpers/src/published-routes.ts` has two operations over one rule:
  - `getPublishedRoute(path)` makes one targeted lookup per route. EmDash's request context decides draft visibility, so admin preview still works.
  - `getPublishedRoutes()` builds the published-only list for the sitemap and `llms.txt`.
- Every content route asks it, `/posts` and `/projects` 404 when empty, missing post, category and tag pages rewrite to 404 instead of a 302, and the 13 numbered template routes and all template fallback copy are removed. The rules are in `docs/published-routes.md`.
- Review: Standards and Spec reviewers, then the orchestrator's own read, which found that draft preview 404'd (fix round 2). CI re-run locally on every round: exit 0.
- Box 1: CI's rendered check, with a published and an unpublished seed and real preview tokens.
- Box 2, on staging after deploy run 43194270084:

```
Staging sitemap paths against staging, 2026-11-12T09:50:12Z, deploy run 43194270084 (master 2927792)
200 https://staging.jamesryan.dev/privacy-policy
200 https://staging.jamesryan.dev/pricing
200 https://staging.jamesryan.dev/about
200 https://staging.jamesryan.dev/
200 https://staging.jamesryan.dev/posts/agent-test-contributor-publishing-path
200 https://staging.jamesryan.dev/posts/service-account-vs-service-principal-in-power-platform
200 https://staging.jamesryan.dev/posts/how-to-run-javascript-in-power-automate
200 https://staging.jamesryan.dev/posts/how-to-implement-a-try-catch-pattern-in-power-automate
200 https://staging.jamesryan.dev/posts/essential-tools-for-power-platform-consultants
200 https://staging.jamesryan.dev/posts/how-to-create-a-reusable-in-app-notification-feature-in-power-platform-and-d365
200 https://staging.jamesryan.dev/posts/get-started-with-playwright-for-power-apps
200 https://staging.jamesryan.dev/posts
-- not listed:
404 https://staging.jamesryan.dev/contact
404 https://staging.jamesryan.dev/projects
404 https://staging.jamesryan.dev/home-01
404 https://staging.jamesryan.dev/pricing-02
404 https://staging.jamesryan.dev/about-01
```

- The staging sitemap's `<loc>` URLs use `https://jamesryan.dev`, the configured site URL; the check above requests the same paths on staging.
- `validate-rendered-seo.mjs https://staging.jamesryan.dev` still fails on staging content: SEO fields that are empty or over length, and the notification post's duplicate H1. Ticket 18 fixed those on production only. Staging also still has Pricing and Privacy Policy published.
- For James: fill the Posts collection description (Content Types → Posts). Until then, `/posts` uses the tagline. See `docs/posts-description.md`.
- Evidence: `.orchestrate/runs/2026-11-12-23-published-pages/`.

