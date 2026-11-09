# 08-2655a1e3: Deploy staging on merge and promote production manually

**Spec:** docs/specs/baseline.md

**What to build:**

Add `.github/workflows/deploy.yml`. On push to `master` after CI passes, it deploys both apps with `--env staging`, runs D1 migrations, then runs smoke checks against `staging.jamesryan.dev` and `staging.jamesryan.me` (home, a post, admin login page, `robots.txt`, `sitemap.xml`, `llms.txt` return 200). A `workflow_dispatch` "promote" job deploys jamesryan.dev production from the same commit as staging, behind a GitHub environment with James as the required reviewer. Garden has no production job. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (James adds them; provide a wizard). Document deploys in `docs/deploying.md` and remove `pnpm deploy` paths that bypass staging.

**Blocked by:** 02-008a2b07, 05-10cd2eae, 07-2cb06315.

**Status:** needs James: run `scripts/wizards/deploy-secrets.sh` to add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then merge `baseline` into `master` (that first run proves boxes 1 and 2)

- [ ] A merge to `master` lands on both staging sites with smoke checks green.
- [ ] Promotion deploys exactly the staging commit to jamesryan.dev and needs James's approval.
- [x] There's no documented or scripted way to deploy production except promotion.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: high (no docs/agents/review.md; CI definition, deploys and production promotion).

**2026-11-08 Claude (orchestrator):** Built by h08-copilot (Copilot, GPT-6.1 Terra), PR #12 (ef14fb8, 82ac849, 4d6fdfb, d9e303c) merged into `baseline`; merged-tree checks pass (`ℹ tests 8`, `ℹ pass 8`). `.github/workflows/deploy.yml`: after CI passes on a push to `master`, builds with `CLOUDFLARE_ENV=staging` (Astro fixes the Wrangler environment at build time; `--env staging` alone kept production bindings), deploys both sites to staging, smoke-checks home, admin login, robots, sitemap, llms.txt and a sitemap post (`scripts/smoke-staging.mjs`; the garden's post check is optional so an empty garden can't block jamesryan.dev's promotion), verifies D1 migrations with `emdash migrate --check`, and records the staged SHA. Stale CI runs are rejected. `workflow_dispatch` promotion resolves the latest successful staging run, waits for the `production` environment (created via API: required reviewer jimiryquai, `can_admins_bypass: false`, `master` only), re-checks that staging hasn't moved, and deploys exactly that SHA to jamesryan.dev. Direct `deploy` scripts and the README's bypass are gone; `docs/deploying.md` documents both paths. Review (Anthropic over OpenAI): `concurrency.queue: max` checked against GitHub's 2026-05-07 changelog; fix round 1 made the garden's post check optional. Dry runs pick the staging bindings; live smoke today: staging.jamesryan.dev 6/6 200, staging.jamesryan.me not yet deployed. Watch on the first run: the wizard's token may need extra permissions for the `staging.jamesryan.me` custom domain or the Cloudflare Images binding; the failing step will name it. Evidence: `.orchestrate/runs/2026-11-08-08-deploy-pipeline/`.
