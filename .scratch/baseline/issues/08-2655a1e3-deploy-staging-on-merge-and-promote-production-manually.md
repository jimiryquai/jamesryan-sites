# 08-2655a1e3: Deploy staging on merge and promote production manually

**Spec:** docs/specs/baseline.md

**What to build:**

Add `.github/workflows/deploy.yml`. On push to `master` after CI passes, it deploys both apps with `--env staging`, runs D1 migrations, then runs smoke checks against `staging.jamesryan.dev` and `staging.jamesryan.me` (home, a post, admin login page, `robots.txt`, `sitemap.xml`, `llms.txt` return 200). A `workflow_dispatch` "promote" job deploys jamesryan.dev production from the same commit as staging, behind a GitHub environment with James as the required reviewer. Garden has no production job. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (James adds them; provide a wizard). Document deploys in `docs/deploying.md` and remove `pnpm deploy` paths that bypass staging.

**Blocked by:** 02-008a2b07, 05-10cd2eae, 07-2cb06315.

**Status:** ready-for-agent

- [ ] A merge to `master` lands on both staging sites with smoke checks green.
- [ ] Promotion deploys exactly the staging commit to jamesryan.dev and needs James's approval.
- [ ] There's no documented or scripted way to deploy production except promotion.

## Comments
