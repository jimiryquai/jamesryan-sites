# 02-008a2b07: Add CI for PRs: typecheck, build and tests for both apps

**Spec:** docs/specs/baseline.md

**What to build:**

Add `.github/workflows/ci.yml`: on PR and push to `master`, run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, and any `test` scripts across the workspace. Use pnpm's cache and pin action versions to SHAs. Make the job a required status check on `master` (James does the branch-protection click if a token can't). No deploys in this ticket.

**Blocked by:** 01-39b13245, 15-09e33d29.

**Status:** ready-for-agent

- [ ] A PR shows a green CI run covering both apps.
- [ ] A deliberately broken typecheck fails the run (proved on a throwaway branch, then removed).
- [ ] The workflow sends no telemetry (Astro telemetry disabled with `ASTRO_TELEMETRY_DISABLED=1`, Wrangler with `WRANGLER_SEND_METRICS=false`).

## Comments

**2026-11-08 Claude (orchestrator):** Found while checking 01: on a fresh checkout of `baseline` (before 01) the root `pnpm typecheck` and `pnpm build` fail: `--filter ...` is an invalid selector (`Unsupported package selector`). Per package (`pnpm -r --workspace-concurrency=1`): marketing-site `astro check` fails `Hero.astro:71 Property 'centered' does not exist` (the local checkout passes thanks to gitignored generated state), and the digital-garden build fails `ENOENT … apps/digital-garden/src/icons/` (an empty folder git does not track). Run in parallel, both apps also fight over inspector port 9229 (`EADDRINUSE`). A green CI run needs all four fixed.
