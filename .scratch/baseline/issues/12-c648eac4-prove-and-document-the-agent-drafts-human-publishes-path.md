# 12-c648eac4: Prove and document the agent-drafts, human-publishes path

**Spec:** docs/specs/baseline.md

**What to build:**

Create a scoped EmDash token (drafts only: no publish, no delete) for agents, stored as a secret, never in `.env` in git. Have an agent create a draft post through the EmDash MCP on staging containing: a heading, a Code Block Pro block, an image with alt text, filled SEO fields. James publishes it in the admin; verify the rendered page, the SEO output, the comments form and the validators. Repeat on production with a real (or unlisted) post James picks. Write `docs/publishing.md`: the exact steps and field requirements an agent follows, so people and agents share one documented path. Confirm the token can't publish.

**Blocked by:** 06-7a434f76, 08-2655a1e3, 10-eaea4d2b, 17-caadd917.

**Status:** needs James: publish the draft `[Agent test] …` (slug `agent-test-contributor-publishing-path`) in the staging admin, then the orchestrator checks the page

- [x] A draft created by an agent appears in the admin; the token's publish attempt is refused (output in a comment).
- [ ] The published page passes the validators and axe.
- [ ] `docs/publishing.md` exists and a fresh agent can follow it unaided.

## Comments

**2026-11-08 Claude (orchestrator):** Mermaid dropped from this ticket (James, 2026-11-08): Code Block Pro only highlights Mermaid source, and diagrams belong to the parked `emdash-plugin-diagrams` project.

**2026-11-09 Claude (orchestrator):** h12-copilot (Copilot, GPT-6.1 Terra), PR #22 (f9884ec, 50b55e7, f20d6e6) merged to `master`. Its first run stopped correctly: the token in use published the fixture. The orchestrator traced that in staging D1: the token "Agent Content Media" was owned by James's Admin account (role 50), having been created while the admin's passkey signed him in as himself. With James's approval (auto mode off), the orchestrator:
- deleted that token;
- minted "Agent drafts (Contributor)" for `agent@jamesryan.dev` (role 20) with EmDash's own `generatePrefixedToken`, storing only its hash, and wrote the raw token to `.env` unseen;
- moved the published fixture to draft and the trash.

The Agent account has no passkey; it's a token-only service account. Fix round 1, with the new token: the draft `agent-test-contributor-publishing-path` was created through MCP (authored by agent@jamesryan.dev). `content_publish` and `content_delete` both returned `[INSUFFICIENT_PERMISSIONS] Insufficient permissions for this operation`. `docs/publishing.md` now starts with a required check of the token's owner and role from D1. MCP: `emdash-staging-agent` in `config/mcporter.json` (mcporter HTTP, Bearer from the environment). Evidence: `.orchestrate/runs/2026-11-09-12-agent-drafts/`.
