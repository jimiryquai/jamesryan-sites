# Deploying

Run `scripts/wizards/deploy-secrets.sh` once from the repository root to add the
Cloudflare account ID and scoped API token to GitHub Actions. It does not save
the token locally. The `production` environment must require review by
`jimiryquai`, disallow administrator bypass, and allow only the `master`
branch; verify this under Settings > Environments before promoting.

After CI succeeds for a push to `master`, the Deploy workflow builds with
`CLOUDFLARE_ENV=staging` and deploys both sites to staging. This build setting
is essential: Astro generates Wrangler's deployment configuration at build
time, and passing `--env staging` to Wrangler alone otherwise retains
production bindings. The workflow requests each staging home page, post,
admin login, robots, sitemap and llms file, verifies migrations, and records
the commit only if all checks pass. Posts are discovered from each sitemap;
each staging site needs a published post.

To promote, open Actions > Deploy > Run workflow, select `master`, and approve
the `production` environment deployment. Inspect the latest staging run and
its commit before approval. Promotion fails closed if the latest staging run
is incomplete or failed or its commit artifact has expired (90 days); rerun
CI on the current master commit to produce a fresh staging run. It checks out
that recorded commit, builds it again and deploys only jamesryan.dev. The garden
has no production promotion.

Deployments are serialized. A newer pending deployment can replace an older
pending run under GitHub Actions concurrency rules; inspect Actions if a run
is skipped or cancelled. A newer push can also make an older completed CI run
stale, in which case staging rejects it.

EmDash's default `auto` mode applies ordinary core migrations on the first
request after deployment, and the workflow then runs `emdash migrate --check`
against each explicitly selected D1 database. Large content migrations are not
automatic on Workers: they require a reviewed recovery point and a separate
operator-run migration; the workflow fails rather than reporting a healthy
site. See [EmDash Cloudflare deployment](https://docs.emdashcms.com/deployment/cloudflare/)
and [core migrations](https://docs.emdashcms.com/deployment/core-migrations/).
Check backup/recovery readiness before merging a change with pending migrations.
