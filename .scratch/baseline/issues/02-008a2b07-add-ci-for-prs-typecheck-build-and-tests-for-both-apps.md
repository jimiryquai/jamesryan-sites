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
