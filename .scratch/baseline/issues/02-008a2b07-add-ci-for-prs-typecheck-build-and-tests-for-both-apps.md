# 02-008a2b07: Add CI for PRs: typecheck, build and tests for both apps

**Spec:** docs/specs/baseline.md

**What to build:**

Add `.github/workflows/ci.yml`: on PR and push to `master`, run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, and any `test` scripts across the workspace. Use pnpm's cache and pin action versions to SHAs. Make the job a required status check on `master` (James does the branch-protection click if a token can't). No deploys in this ticket.

**Blocked by:** 01-39b13245, 15-09e33d29.

**Status:** done

- [x] A PR shows a green CI run covering both apps.
- [x] A deliberately broken typecheck fails the run (proved on a throwaway branch, then removed).
- [x] The workflow sends no telemetry (Astro telemetry disabled with `ASTRO_TELEMETRY_DISABLED=1`, Wrangler with `WRANGLER_SEND_METRICS=false`).

## Comments

**2026-11-08 Claude (orchestrator):** Found while checking 01: on a fresh checkout of `baseline` (before 01) the root `pnpm typecheck` and `pnpm build` fail: `--filter ...` is an invalid selector (`Unsupported package selector`). Per package (`pnpm -r --workspace-concurrency=1`): marketing-site `astro check` fails `Hero.astro:71 Property 'centered' does not exist` (the local checkout passes thanks to gitignored generated state), and the digital-garden build fails `ENOENT … apps/digital-garden/src/icons/` (an empty folder git does not track). Run in parallel, both apps also fight over inspector port 9229 (`EADDRINUSE`). A green CI run needs all four fixed.

**2026-11-08 Claude (orchestrator):** Done in 02-ci (PR #6), merged to `baseline`; worked by the orchestrator directly while helpers were parked. Correction to my note above: the `Hero.astro` error was a real defect (`Props` lacked `centered`), not local state; that "local checkout passes" run had printed nothing. Fixed all four: root scripts now `pnpm -r --if-present …` (plus a root `test`), `centered` declared, `src/icons/.gitkeep` in both apps, `inspectorPort: false` outside dev. pnpm comes from `packageManager`, Node from `.node-version`. CI run 42480642855 on PR #6: every step green, both apps typechecked and built, 56 tests passed. Throwaway PR #7 with a type error: run 42480659015 failed at `pnpm typecheck` (`ci-probe.ts:2:7 ts(2322)`); PR closed and branch deleted. Telemetry: the workflow sets `ASTRO_TELEMETRY_DISABLED=1` and `WRANGLER_SEND_METRICS=false`. Required check: ruleset 26797610 "master: CI required" (active, no bypass) requires "Typecheck, build and test" on `master`. Evidence: `.orchestrate/runs/2026-11-08-02-ci/`.
