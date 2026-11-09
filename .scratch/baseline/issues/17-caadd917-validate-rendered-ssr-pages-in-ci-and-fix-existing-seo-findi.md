# 17-caadd917: Validate rendered SSR pages in CI and fix existing SEO findings

**Spec:** docs/specs/baseline.md

**What to build:**

Split from ticket 10 (2026-11-08). `@jdevalk/astro-seo-graph` 2.2's build-time validators (H1, unique metadata, image alt, metadata length, internal links) only scan static HTML (its README, lines 690-698) and only warn (`dist/integration.js` 693-761). Both apps render on the server, so every build reports `H1 validation: 0 pages checked, all good.`: no coverage. Ticket 10's local scan of rendered seed content already finds real problems, for example `pages/about/index.html has no <h1>` (`.orchestrate/runs/…-10-…/evidence/seo-rendered-baseline.log`).

Make the validators check rendered pages and fail the required CI check:

1. In CI, after `pnpm build`, serve each app against seeded local data (the apps' `seed/seed.json`; `astro preview` or `wrangler dev` on the built worker), crawl its sitemap, and run the validators over the rendered HTML. Use the package's validator functions if it exports them; otherwise its integration's logic, cited. One script for both apps, reading each app's origin and options as data.
2. Validator failures fail the job, with the page and the rule in the log.
3. Fix the existing findings at their source (templates, or seed content), never by excluding pages or rules. If a finding is a false positive, say why in the commit and the ticket.
4. Keep it inside `.github/workflows/ci.yml`'s required "Typecheck, build and test" check (or a second required job, added to the `master` ruleset), so a PR can't merge with a failure.

**Blocked by:** none.

**Status:** in progress (fix round 2)

- [x] CI validates the rendered pages of both apps (the log lists the pages checked, more than zero per app) and the run fails on any validator error.
- [ ] Existing findings are fixed at their source; a clean `baseline` passes.
- [x] A page with a missing H1 or image alt fails CI (proved on a throwaway branch, then removed).

## Comments

**2026-11-08 Claude (orchestrator):** Split out of 10 because the validators only scan static output; `llms.txt` and the SEO override stay in 10. Risk when claimed: high (CI definition, and possibly the `master` ruleset).

**2026-11-08 Claude (orchestrator):** Unblocked: it needs 10's merged code (PR #13), not 10's remaining staging check. Risk: high (CI definition, maybe the `master` ruleset).

**2026-11-08 Claude (orchestrator):** Built by h17-copilot (Copilot, GPT-6.1 Terra), PR #14 (8b8f43e, 13c9fe0, 546a37f), CI green, not merged. `scripts/check-rendered-seo.sh` seeds an isolated local D1 per app from `seed/seed.json`, serves the built worker with `wrangler dev --local`, and `scripts/validate-rendered-seo.mjs` crawls the sitemap with astro-seo-graph's exported validators (one H1, image alt, title/description present, 30–65 and 70–200 characters, unique) plus redirect-aware internal links; it runs in the required "Typecheck, build and test" job (13 pages for jamesryan.dev, 11 for the garden). Throwaway PR #15 failed with `/contact: H1 validation: expected 1, found 0`, then was closed and its branches deleted. Fix round 1: missing title or description now fails. Box 2 waits on James: to pass the length rules the fixes rewrote user-visible copy (about 25 template strings that reach the live sites on the next deploy, several replacing CMS-settings-driven titles with hard-coded text, plus about 10 seed titles and excerpts); the full before/after table is `copy-changes.md` in the evidence folder.

**2026-11-09 Claude (orchestrator):** James's decisions on the copy review. Agents write no copy: titles and descriptions come from each entry's CMS SEO fields (admin or the EmDash MCP), with templates only falling back to the entry's own fields. The garden is out of scope (not live, not the priority): CI checks the marketing site only, and every garden change is reverted. Fix round 2 reverts all copy, keeps the structural fixes (duplicate site-name suffix, pricing empty-state H1, contact H1/H2, `ProjectCard` tag link), reads SEO fields on every entry route, and runs CI against a fixture seed so a red run means a template bug. Findings in James's real seed content go to him as a list (`content-findings.md`) and are fixed in the admin, not by agents. Box 1 now means the marketing site.
