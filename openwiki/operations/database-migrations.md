---
type: operations runbook
title: Database migration management
description: How D1 schema changes reach Cloudflare — migrate-deployment.sh's status/apply/check/recover operations, reviewed target fingerprints, and the lock-takeover recovery procedure.
tags: [d1, migrations, emdash, deployment, fingerprints, runbook]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-6766b7a0c14857435d2077c9
    resource: repo://.github/workflows/deploy.yml
  - id: openwiki-source-2259063a20830409cc3a930b
    resource: repo://docs/deploying.md
  - id: openwiki-source-b60d850b54513f836c0e941e
    resource: repo://scripts/migrate-deployment.sh
  - id: openwiki-source-7fad1c5bb43bae95fe4a2a97
    resource: repo://scripts/migrate-deployment.test.mjs
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

<!-- openwiki: broken internal link [/openwiki/architecture/cloudflare-emdash-runtime.md] link "/openwiki/architecture/cloudflare-emdash-runtime.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
EmDash migrations are applied by CI between build and deploy, never by deployed Workers (the runtime `check` policy — see [Cloudflare and EmDash runtime](/openwiki/architecture/cloudflare-emdash-runtime.md)). `scripts/migrate-deployment.sh` is the single wrapper every migration command goes through, run from the app directory so it consumes **only that build's** `.emdash/migrations.json` manifest, with `--wrangler-config wrangler.jsonc` and `--account-id` from `CLOUDFLARE_ACCOUNT_ID`; staging additionally passes `--wrangler-env staging`. No manifests are ever downloaded from other builds.

## Operations

`bash scripts/migrate-deployment.sh <app> <environment> <operation> [lock_id]` — `app` must be `marketing-site` or `digital-garden`, `environment` `staging` or `production`:

- **`check`** — `emdash migrate --check --json`; verifies schema after deploy.
- **`status`** — `emdash migrate --status --json` to a temp file, printed to stdout; read-only inspection (also the `migration-status` workflow input).
- **`apply`** — status first (progress to stderr), then `emdash migrate --json --expected-target-fingerprint <reviewed> < /dev/null`.
- **`recover`** — like apply plus `--take-over-lock <numeric id>` (the workflow's `recover-lock` input passes `inputs.lock_id`); requires a numeric lock id.

## Reviewed target fingerprints

The migration target (account, database UUID, and migration set) hashes to a 64-hex fingerprint. Each app/environment pair has a GitHub Actions **variable** (not secret) holding the reviewed value — `MARKETING_SITE_STAGING_MIGRATION_FINGERPRINT`, `MARKETING_SITE_PRODUCTION_MIGRATION_FINGERPRINT`, `DIGITAL_GARDEN_STAGING_MIGRATION_FINGERPRINT`, `DIGITAL_GARDEN_PRODUCTION_MIGRATION_FINGERPRINT` — fed to the job as `EXPECTED_TARGET_FINGERPRINT`.

If the variable is missing, the script parses the status JSON, validates the fingerprint shape, prints the full target plus the exact `gh variable set … --body …` command, and **fails before applying anything**. A mismatched fingerprint is rejected by EmDash itself. A freshly discovered fingerprint must be reviewed by a human against account/environment/database before it is accepted into the variable — never auto-accepted in CI. New values are produced by dispatching `migration-status` on `master` and choosing the app/environment (production inspection passes through the `production` approval environment); `scripts/wizards/deploy-secrets.sh` can then record them.

## Lock recovery

Migration and deploy/recovery jobs share a per-app/environment concurrency group (e.g. `d1-marketing-site-staging`), so overlapping Actions jobs cannot migrate the same database; runs queue without cancellation. When a lock is nonetheless stuck — including locks left by the old runtime `auto` Workers — the recovery procedure is:

1. Confirm no migration job, deployment, or other `emdash migrate` command is running against the target, including outside GitHub Actions.
2. Dispatch `migration-status`, inspect the lock id, target, and applied/pending sets.
3. Wait at least a minute and repeat; if applied migrations are still changing, keep waiting — never take over an active run.
4. Once stable, dispatch `recover-lock` with the observed numeric `lock_id` (review the fingerprint variable first; production recovery passes through the `production` environment).
5. The job builds, re-runs status, then applies with `--take-over-lock <id> --expected-target-fingerprint <reviewed>` and verifies with `--check`. Recovery deploys no Worker; rerun the staging pipeline and promote normally afterwards.

Take-over transfers the lock directly instead of releasing and reacquiring, so an older `auto` Worker cannot race into the gap. If a pending migration fails after an interrupted D1 write, the partially applied migration must be inspected and EmDash's ambiguous-write troubleshooting followed before retrying; core migrations are forward-only and backup readiness should be checked first.

`scripts/migrate-deployment.test.mjs` fakes only the `pnpm`/`emdash` CLI boundary (no test contacts Cloudflare) and asserts the argument vectors — including that a missing fingerprint never reaches an applying command.
