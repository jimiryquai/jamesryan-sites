# 17-caadd917: Validate rendered SSR pages in CI and fix existing SEO findings

**Spec:** docs/specs/baseline.md

**What to build:**

Split from ticket 10 (2026-11-08). `@jdevalk/astro-seo-graph` 2.2's build-time validators (H1, unique metadata, image alt, metadata length, internal links) only scan static HTML (its README, lines 690-698) and only warn (`dist/integration.js` 693-761). Both apps render on the server, so every build reports `H1 validation: 0 pages checked, all good.`: no coverage. Ticket 10's local scan of rendered seed content already finds real problems, for example `pages/about/index.html has no <h1>` (`.orchestrate/runs/…-10-…/evidence/seo-rendered-baseline.log`).

Make the validators check rendered pages and fail the required CI check:

1. In CI, after `pnpm build`, serve each app against seeded local data (the apps' `seed/seed.json`; `astro preview` or `wrangler dev` on the built worker), crawl its sitemap, and run the validators over the rendered HTML. Use the package's validator functions if it exports them; otherwise its integration's logic, cited. One script for both apps, reading each app's origin and options as data.
2. Validator failures fail the job, with the page and the rule in the log.
3. Fix the existing findings at their source (templates, or seed content), never by excluding pages or rules. If a finding is a false positive, say why in the commit and the ticket.
4. Keep it inside `.github/workflows/ci.yml`'s required "Typecheck, build and test" check (or a second required job, added to the `master` ruleset), so a PR can't merge with a failure.

**Blocked by:** 10-eaea4d2b.

**Status:** ready-for-agent

- [ ] CI validates the rendered pages of both apps (the log lists the pages checked, more than zero per app) and the run fails on any validator error.
- [ ] Existing findings are fixed at their source; a clean `baseline` passes.
- [ ] A page with a missing H1 or image alt fails CI (proved on a throwaway branch, then removed).

## Comments

**2026-11-08 Claude (orchestrator):** Split out of 10 because the validators only scan static output; `llms.txt` and the SEO override stay in 10. Risk when claimed: high (CI definition, and possibly the `master` ruleset).
