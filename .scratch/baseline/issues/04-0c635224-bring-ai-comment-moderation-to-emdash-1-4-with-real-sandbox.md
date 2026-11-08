# 04-0c635224: Bring AI Comment Moderation to EmDash 1.4 with real sandbox tests

**Spec:** docs/specs/baseline.md

**What to build:**

Work in `../emdash-plugin-ai-comment-moderation`. Bring it to EmDash 1.4's sandboxed format (`emdash-plugin.jsonc` plus the plugin entry, per the docs MCP and `emdash-plugin init`). Keep the existing mocked unit tests. Add integration tests that run the plugin in a real sandbox runner through `@emdash-cms/plugin-test`, if it supports that; if it doesn't, write `scripts/e2e-staging.mjs`, which posts a clean, a spam and a toxic comment to a given site URL and asserts approved, spam and pending. Workers AI is stubbed only at the HTTP boundary in the integration tests. Prepare the release and stop for James's publish approval.

**Blocked by:** none.

**Status:** done

- [x] Integration tests exercise the real sandbox path (or the e2e script exists and is documented, with the reason recorded).
- [x] Peer range is `^1.4.0`; tests pass in CI.
- [x] Release PR ready; status `needs James` for publish.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: high (no docs/agents/review.md; release PR in another repo leading to a public npm publish, and sandbox capabilities with a network call to Workers AI).

**2026-11-08 Claude (orchestrator):** Built by h04-codex (Codex, GPT-6.1 Sol) in `../emdash-plugin-ai-comment-moderation`, branch `04-comment-moderation-1-4`, commits 050e52e, c476d60, dd6ea8d, 3922588 and f7f7981; release PR jimiryquai/emdash-plugin-ai-comment-moderation#1 (2.0.0, peer `emdash ^1.4.0`, a major because 0.9 support and the old factory go). Sandboxed format via `emdash-plugin.jsonc` and the plugin CLI; capabilities `network:request` (only `api.cloudflare.com`) and `users:read`. `@emdash-cms/plugin-test` 0.2.11 runs the production Cloudflare sandbox runner, so 10 new integration tests submit comments through EmDash and check stored statuses (clean approved, spam spam, toxic pending, plus fallbacks), with Workers AI stubbed only at outbound HTTP; the 23 mocked tests remain. Orchestrator re-ran `npm ci`, `npx tsc --noEmit`, `npm run validate`, `npm run build` and `npx vitest run` (33 passed); PR checks green on f7f7981. Cross-family review fixes: round 1 added the `repository` field `npm publish --provenance` needs and moved every workflow to `npm ci` for the committed lockfile; round 2 licensed it MIT (James, 2026-11-08). For ticket 11: the plugin reads its Workers AI account ID and token from its own settings, not Wrangler secrets, since a sandboxed plugin can't see the worker's secrets. For the registry backlog item: the manifest's `publisher: jamesryan.dev` is not a verified identity. Evidence: `.orchestrate/runs/2026-11-08-04-comment-moderation-1-4/`.

**2026-11-08 Claude (orchestrator):** Published. The first `v2.0.0` publish run failed for want of a trusted publisher on npmjs.com (npm 11 was already in the workflow); James added it with `npm trust github … --file publish.yml --allow-publish`, and the re-run (42485957826, attempt 2) published `emdash-plugin-ai-comment-moderation@2.0.0` with provenance. npm: `latest` = 2.0.0. Worktree and branch tidied.
