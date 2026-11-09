# 08-2655a1e3: Deploy staging on merge and promote production manually

**Spec:** docs/specs/baseline.md

**What to build:**

Add `.github/workflows/deploy.yml`. On push to `master` after CI passes, it deploys both apps with `--env staging`, runs D1 migrations, then runs smoke checks against `staging.jamesryan.dev` and `staging.jamesryan.me` (home, a post, admin login page, `robots.txt`, `sitemap.xml`, `llms.txt` return 200). A `workflow_dispatch` "promote" job deploys jamesryan.dev production from the same commit as staging, behind a GitHub environment with James as the required reviewer. Garden has no production job. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (James adds them; provide a wizard). Document deploys in `docs/deploying.md` and remove `pnpm deploy` paths that bypass staging.

**Blocked by:** 02-008a2b07, 05-10cd2eae, 07-2cb06315.

**Status:** done

- [x] A merge to `master` lands on both staging sites with smoke checks green.
- [x] Promotion deploys exactly the staging commit to jamesryan.dev and needs James's approval.
- [x] There's no documented or scripted way to deploy production except promotion.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: high (no docs/agents/review.md; CI definition, deploys and production promotion).

**2026-11-08 Claude (orchestrator):** Built by h08-copilot (Copilot, GPT-6.1 Terra), PR #12 (ef14fb8, 82ac849, 4d6fdfb, d9e303c) merged into `baseline`; merged-tree checks pass (`ℹ tests 8`, `ℹ pass 8`). `.github/workflows/deploy.yml`: after CI passes on a push to `master`, builds with `CLOUDFLARE_ENV=staging` (Astro fixes the Wrangler environment at build time; `--env staging` alone kept production bindings), deploys both sites to staging, smoke-checks home, admin login, robots, sitemap, llms.txt and a sitemap post (`scripts/smoke-staging.mjs`; the garden's post check is optional so an empty garden can't block jamesryan.dev's promotion), verifies D1 migrations with `emdash migrate --check`, and records the staged SHA. Stale CI runs are rejected. `workflow_dispatch` promotion resolves the latest successful staging run, waits for the `production` environment (created via API: required reviewer jimiryquai, `can_admins_bypass: false`, `master` only), re-checks that staging hasn't moved, and deploys exactly that SHA to jamesryan.dev. Direct `deploy` scripts and the README's bypass are gone; `docs/deploying.md` documents both paths. Review (Anthropic over OpenAI): `concurrency.queue: max` checked against GitHub's 2026-05-07 changelog; fix round 1 made the garden's post check optional. Dry runs pick the staging bindings; live smoke today: staging.jamesryan.dev 6/6 200, staging.jamesryan.me not yet deployed. Watch on the first run: the wizard's token may need extra permissions for the `staging.jamesryan.me` custom domain or the Cloudflare Images binding; the failing step will name it. Evidence: `.orchestrate/runs/2026-11-08-08-deploy-pipeline/`.

**2026-11-09 Claude (orchestrator):** First real run (Deploy run 42599566490) deployed both staging workers and attached both custom domains, then failed its smoke checks. EmDash's runtime `auto` mode began migrating inside the Worker on the first smoke requests (10:18:35), stopped part-way, and left the D1 migration lock held. Both staging sites answer 503: marketing is at `071` with 20 pending, the garden at `064`. Fix round on branch `08-migrate-before-deploy`, following EmDash's core-migrations guide: migrate from CI before deploying, runtime `check` in deployed environments, reviewed target fingerprints as GitHub variables, a dispatch path to recover a stuck lock, and smoke checks that wait for a new domain. Production would have hit the same failure on first promotion. Risk: high.

**2026-11-09 Claude (orchestrator):** Box 1 proved. h08b-codex (Codex, GPT-6.1 Sol) built PR #17 (7aaaa16, fd1d982), merged to `master` as 2c845d3. The orchestrator re-ran typecheck, build, test (24 pass) and the rendered SEO check; PR CI was green. The deploy now applies migrations from CI under a reviewed target fingerprint before deploying, the runtime is in `check` mode, a dispatch job recovers a stuck lock, and smoke checks wait for new domains. Live:
- `migration-status` on both staging databases matched `wrangler d1 list` (`c623fded…`, `449e7ed9…`); the orchestrator set the two staging fingerprint variables.
- `recover-lock` took over locks `1794219515159` and `1794219534177` and applied the pending migrations: `pending: []`, `--check` passed.
- Deploy run 42603619880 (re-run) passed both staging jobs and `record-staging`. Two outside causes were fixed by James: Cloudflare Bot Fight Mode managed-challenged GitHub's runners (AS8075; it can't be skipped on the free plan, so it's off on both zones), and the garden's fresh database needed EmDash's first-run setup.

The production fingerprint is set at the first promotion. Evidence: `.orchestrate/runs/2026-11-09-08-migrate-before-deploy/`.

**2026-11-09 Claude (orchestrator):** Done. First promotion, run 42615980968: `identify-staging` resolved staging run 42603619880's commit `2c845d3`, the promotion waited for James's approval in the `production` environment, then applied 52 migrations (039 → 091) under the reviewed fingerprint (`jamesryan-emdash`, `3c250296…`, checked against `wrangler d1 list`), deployed version `8b065441`, and smoke and `--check` passed. Restore point taken first: Time Travel bookmark `00005a83-00000000-0000511e-0401ed25f6b5359377cc1a712fcea8bd`. Auto mode refuses to dispatch a production deploy, so James turned it off for this step.
