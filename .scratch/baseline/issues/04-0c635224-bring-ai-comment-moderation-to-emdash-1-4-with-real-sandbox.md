# 04-0c635224: Bring AI Comment Moderation to EmDash 1.4 with real sandbox tests

**Spec:** docs/specs/baseline.md

**What to build:**

Work in `../emdash-plugin-ai-comment-moderation`. Bring it to EmDash 1.4's sandboxed format (`emdash-plugin.jsonc` plus the plugin entry, per the docs MCP and `emdash-plugin init`). Keep the existing mocked unit tests. Add integration tests that run the plugin in a real sandbox runner through `@emdash-cms/plugin-test`, if it supports that; if it doesn't, write `scripts/e2e-staging.mjs`, which posts a clean, a spam and a toxic comment to a given site URL and asserts approved, spam and pending. Workers AI is stubbed only at the HTTP boundary in the integration tests. Prepare the release and stop for James's publish approval.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] Integration tests exercise the real sandbox path (or the e2e script exists and is documented, with the reason recorded).
- [ ] Peer range is `^1.4.0`; tests pass in CI.
- [ ] Release PR ready; status `needs James` for publish.

## Comments
