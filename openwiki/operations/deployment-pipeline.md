---
type: operations pipeline
title: Deployment pipeline
description: The CI gates and Deploy workflow — staging deploys per app on master merge, manual production promotion bound to a staged commit, migration recovery dispatches, and the one-time secrets wizard.
tags: [ci, github-actions, deployment, cloudflare, staging, production]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-13T16:28:46.089Z
sources:
  - id: openwiki-source-164e2da859b5277df81c7d94
    resource: repo://.github/workflows/ci.yml
  - id: openwiki-source-6766b7a0c14857435d2077c9
    resource: repo://.github/workflows/deploy.yml
  - id: openwiki-source-2259063a20830409cc3a930b
    resource: repo://docs/deploying.md
  - id: openwiki-source-02227a9a8b26a7c3085c8158
    resource: repo://scripts/wizards/deploy-secrets.sh
generated: { by: "claude-code", at: "2026-11-13T16:28:46.089Z" }
---

## CI (`.github/workflows/ci.yml`)

<!-- openwiki: broken internal link [/openwiki/operations/verification-suite.md] link "/openwiki/operations/verification-suite.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
Runs on pull requests and pushes to `master` (concurrency `ci-<ref>`, cancelling in-progress runs). One `check` job with telemetry env forced off: pinned actions, pnpm from `package.json`'s `packageManager`, Node from `.node-version`, `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm build`, Playwright Chromium install, `pnpm test`, and `bash scripts/check-rendered-seo.sh`. CI always runs the rendered-SEO check in its fixture mode; details in [Verification and quality checks](/openwiki/operations/verification-suite.md).

## Deploy (`.github/workflows/deploy.yml`)

Two triggers:

- **Automatic**: `workflow_run` on completed CI for `master`. The `staging` matrix job runs **per app** (`fail-fast: false`, concurrency `d1-<app>-staging` queued).
- **Manual `workflow_dispatch`** with `operation` = `promote` | `migration-status` | `recover-lock`, plus `app`, `target_environment`, and `lock_id` inputs for the migration operations.

### Staging job

After rejecting a stale trigger (the triggering CI run's `head_sha` must still be the tip of `master`), each app's job checks out that SHA and runs, in order, with `CLOUDFLARE_ENV: staging`:

1. `pnpm install --frozen-lockfile` and `pnpm --filter <app> build` — bindings are fixed at **build time**, which is why the env var matters more than `--env staging` at deploy time.
2. `migrate-deployment.sh <app> staging apply` with the reviewed fingerprint variable.
3. `wrangler deploy --env staging`.
4. Smoke checks (`smoke-staging.mjs` against the custom domain; marketing requires a published post, garden passes `--posts=optional`).
5. Marketing-only extras: the comment moderation smoke (skipped with a log line when `EMDASH_COMMENT_SMOKE_TOKEN` is unset), Playwright Chromium install, `check-accessibility.mjs` for light and dark, and artifact upload of `.scratch/accessibility/` results (`if: always()`).
6. `migrate-deployment.sh <app> staging check`.

Only after both apps pass everything does `record-staging` write the `staged-sha` artifact (90-day retention) containing the deployed commit.

### Production promotion

`promote` is manual-only on `master` and is **marketing-only** — there is no garden production deployment (its production fingerprint variable exists solely for migration inspection/recovery). `identify-staging` resolves the most recent successful staging `workflow_run`, requires it completed/successful, downloads its `staged-sha` artifact, and validates a 40-hex SHA, echoing the staged commit into the step summary for the approver. The `promote` job then runs under the `production` environment (which must require review by `jimiryquai`, disallow admin bypass, allow only `master`), re-checks that the latest staging run is still the approved one — rejecting an expired artifact (90 days) or a staging run that changed while approval was pending — checks out the **staged SHA** (not the branch tip), and repeats build → migrate apply → `wrangler deploy` (no `--env`: the top-level Wrangler config) → smoke `https://jamesryan.dev` → migrate check. If a fresh staging run is needed, rerun CI on current master first.

### Migration recovery dispatches

<!-- openwiki: broken internal link [/openwiki/operations/database-migrations.md] link "/openwiki/operations/database-migrations.md" is root-absolute, which no real consumer resolves against the repository root (not a coding agent reading the page, not GitHub's Markdown renderer, not a local viewer); use a path relative to this file instead. Fix the href or restore the target, then delete this comment. -->
`migration-status` and `recover-lock` run the `migration-recovery` job for the chosen app/environment (production passes through its approval environment), build the app, and wrap `migrate-deployment.sh` in status or recover mode, verifying with `check` after recovery. See [Database migration management](/openwiki/operations/database-migrations.md).

## Secrets wizard

`scripts/wizards/deploy-secrets.sh` is a one-time interactive wizard from the repository root that writes to GitHub Actions: the Cloudflare account ID, a scoped D1 Edit API token (never saved locally), reviewed migration fingerprint variables, and per-environment `EMDASH_ENCRYPTION_KEY` Worker secrets for the sandboxed moderation plugin (Wrangler must be authenticated to the intended account). Its stages are individually skippable when values already exist. The `production` environment protection settings are verified manually under Settings → Environments before the first promotion.
