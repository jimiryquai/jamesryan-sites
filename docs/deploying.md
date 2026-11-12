# Deploying

Run `scripts/wizards/deploy-secrets.sh` from the repository root to add the
Cloudflare account ID, scoped D1 Edit API token, and reviewed migration target
fingerprints to GitHub Actions. It does not save the token locally. The
`production` environment must require review by `jimiryquai`, disallow
administrator bypass, and allow only `master`; verify this under Settings >
Environments before promoting or recovering production.

## Comment moderation

The marketing site runs `emdash-plugin-ai-comment-moderation` in the Cloudflare
sandbox. Run the deployment secrets wizard to generate a separate
`EMDASH_ENCRYPTION_KEY` for each marketing Worker before entering plugin secrets.
The key stage needs Wrangler authenticated to the intended Cloudflare account.
Save each key in a password manager separately from D1 backups. Skip a target
that already has a key: replacing it makes existing encrypted settings
unreadable. For rotation and recovery, follow [EmDash's secrets guide](https://docs.emdashcms.com/deployment/secrets/).
The wizard can skip its other stages when those values already exist.

After deployment, configure **Cloudflare account ID**, **Workers AI API token**
(encrypted at rest), and optionally **Workers AI model** in the moderator's
EmDash admin settings for each environment. The API token needs Workers AI
access. Without working AI credentials the plugin falls back to the collection's
standard moderation policy, not spam/toxicity classification.

To enable the staging moderation smoke check, create a staging EmDash personal
access token owned by an administrator with the `admin` scope and add it as the
GitHub Actions secret `EMDASH_COMMENT_SMOKE_TOKEN`. The admin scope is required
for comment read and permanent deletion; the owner's role must also grant
`comments:moderate`, `comments:delete`, and `content:read`. If the secret is
absent, the job logs a skip. The check submits three labelled test comments,
reads their statuses, and deletes each immediately. Failed deletion is reported
with its comment ID and fails the job; remove it from the admin inbox. A lost
submission response can leave a comment whose ID is unknown, so inspect the
inbox for `Moderation smoke test` after an interrupted or failed request.
The test uses the first published post and needs comments enabled, no closing
date preventing submissions, and no mandatory Turnstile challenge.
EmDash rate-limits comment submissions; repeated smoke runs within ten minutes
can fail with 429, so wait for the window to expire before retrying.

Before merging the Astro 7 / EmDash 1.5 upgrade, review its
[migration 095 maintenance requirement and target identities](astro-7-upgrade.md#migration-rollout).

After CI succeeds for a push to `master`, Deploy runs one staging job per app:

1. Build with `CLOUDFLARE_ENV=staging`.
2. Inspect D1 with `emdash migrate --status --json`.
3. Apply with `--expected-target-fingerprint` from a reviewed Actions variable.
4. Deploy that build with `wrangler deploy --env staging`.
5. Smoke home, admin login, robots, sitemap, llms.txt and a sitemap post.
6. Verify with `emdash migrate --check`.

Every migration command runs in the app directory, using that job's build
manifest (`.emdash/migrations.json`), `--wrangler-config wrangler.jsonc`, and
`--account-id`. Staging also passes `--wrangler-env staging`; production uses
the top-level Wrangler configuration. No manifests are downloaded from other
builds. `CLOUDFLARE_ENV` matters because Astro fixes deployment bindings at build
time; passing `--env staging` only at deploy time can retain production bindings.

Smoke checks share a three-minute deadline, retrying failed endpoints every
five seconds with request timeouts of at most fifteen seconds. On failure the
script prints each URL's last result. Marketing requires a published post;
the garden checks one if available and otherwise logs `no posts yet`.
`SMOKE_TIMEOUT_MS` and `SMOKE_RETRY_MS` allow shorter local test windows.
The staged SHA artifact is written only after both apps pass all checks.

Both Astro configurations set `migrations: { runtime: "check", dev: "auto" }`.
This policy belongs in application configuration because every deployed
environment uses the same rule. Deployed requests never apply migrations or
acquire the migration lock; known pending migrations produce 503. Development
keeps automatic migrations. Previously a first request could start migrations
inside a Worker, time out, and leave a lock held indefinitely.

## Reviewed target fingerprints

Create these repository Actions variables (not secrets):

| App | Environment | Variable |
| --- | --- | --- |
| marketing-site | staging | `MARKETING_SITE_STAGING_MIGRATION_FINGERPRINT` |
| marketing-site | production | `MARKETING_SITE_PRODUCTION_MIGRATION_FINGERPRINT` |
| digital-garden | staging | `DIGITAL_GARDEN_STAGING_MIGRATION_FINGERPRINT` |
| digital-garden | production | `DIGITAL_GARDEN_PRODUCTION_MIGRATION_FINGERPRINT` |

Use Actions > Deploy > Run workflow on `master`, select `migration-status`,
and choose the app and target environment. This builds and reports the target
without changing D1. Production inspection also requires environment approval.
Review the account, environment and database UUID against the intended target
before accepting `target.fingerprint`. The wizard accepts these printed values.
If a deployment or recovery variable is missing, the job prints the complete
status target and the exact `gh variable set … --repo … --body …` command, then
fails before applying anything. A mismatched fingerprint is rejected by EmDash.
Do not automatically accept a freshly discovered fingerprint in CI.
Garden production is available only for migration inspection/recovery; there
is no garden production deployment.

## Promotion

Open Actions > Deploy > Run workflow, select `master` and `promote`, then
approve the `production` environment. Inspect the staged commit and run in the
summary before approval. Promotion rejects an incomplete/failed latest staging
run, an expired commit artifact (90 days), or a staging run changed while waiting
for approval. Rerun CI on current master if a fresh staging run is needed.
It checks out the recorded staging SHA and builds, inspects, migrates, deploys,
smoke-checks, and verifies jamesryan.dev in that order. There is no direct
production deploy script or garden production promotion.

Workflow runs are queued without cancellation, and migration/deploy/recovery
jobs share a per-app/environment concurrency group, so the same database cannot
be migrated by overlapping Actions jobs. Stale completed CI runs are rejected.

## Recover a stuck migration lock

Use the Actions token; no Cloudflare token is needed on a laptop. This path can
also recover locks left by the old runtime `auto` workers before the first
successful deployment of runtime `check`.

1. Confirm no migration job, deployment, or other `emdash migrate` command is
   running against the target, including outside GitHub Actions.
2. Dispatch `migration-status` on `master` with the chosen app/environment.
   Inspect the lock id, target and applied/pending migration sets.
3. Wait at least a minute and dispatch the same status operation again. If the
   applied migrations are still changing, wait; do not take over an active run.
4. Once no work is running and the migration sets are stable, dispatch
   `recover-lock` with the same target and the observed numeric `lock_id`.
   Review the target fingerprint variable first. Production recovery passes
   through the `production` approval environment.
5. The job builds, runs status again, then applies with
   `--take-over-lock <id> --expected-target-fingerprint <reviewed value>` and
   verifies with `--check`. EmDash rejects a changed lock id or target. A missing
   fingerprint fails before mutation. Recovery does not deploy a Worker;
   rerun the staging pipeline afterward and promote normally.

Take-over transfers the lock directly, so an older `auto` Worker cannot race
into a gap created by releasing it. If a pending migration fails after an
interrupted D1 write, inspect the partially applied migration and follow
EmDash's ambiguous-write troubleshooting before retrying. Check backup/recovery
readiness before migrations; core migrations are forward-only.

This follows EmDash's [core migration guidance](https://docs.emdashcms.com/deployment/core-migrations/):
“Build, migrate, deploy, check”, “Configure D1 migrations in CI”, “Adopt runtime
enforcement gradually”, and “Release a stuck migration lock”.
