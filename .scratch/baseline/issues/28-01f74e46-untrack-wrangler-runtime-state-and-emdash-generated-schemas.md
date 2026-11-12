# 28-01f74e46: Untrack .wrangler runtime state and .emdash generated schemas from git

**Spec:** docs/specs/baseline.md

**What to build:**

`.gitignore:22` ignores `.wrangler/` and `.gitignore:47` ignores `.emdash/`, yet `git ls-files` still tracks 215 files under `.wrangler/` (`.wrangler/deploy/config.json`, 45 session KV blobs under `.wrangler/state/v3/kv/SESSION/blobs/*`, a Miniflare D1 SQLite database under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` containing a local `dev@emdash.local` user row, and 146 R2 media blobs under `.wrangler/state/v3/r2/*`) plus six generated schema/type cache files (`.emdash/schema.json`, `.emdash/types.ts`, `apps/marketing-site/seed/.emdash/{schema.json,types.ts}`, and `apps/digital-garden/seed/.emdash/{schema.json,types.ts}`). Untrack all ignored `.wrangler/` and `.emdash/` files from git (`git rm --cached`) without deleting local working state, and add a lightweight CI guard verifying `git ls-files` tracks no `.wrangler/` or `.emdash/` paths.

**Blocked by:** none.

**Status:** in progress

- [ ] `git ls-files '.wrangler*' '**/.wrangler*' '.emdash*' '**/.emdash*'` returns zero tracked files.
- [ ] CI fails if any `.wrangler/` or `.emdash/` runtime/generated artifact is committed in a future PR.
- [ ] `pnpm typecheck` and `pnpm build` continue to succeed from a clean checkout without pre-committed `.wrangler/` or `.emdash/` directories.

## Comments

**2026-11-12 Gemini (agy Carbon, orchestrator):** Promoted to `baseline` and claiming for `h28-grok` (`grok-4.7`, branch `28-untrack-runtime-state`). Risk: medium (reversible PR to `master`; keep CI guard in a Node test under `scripts/` so `.github/workflows/ci.yml` is untouched).
