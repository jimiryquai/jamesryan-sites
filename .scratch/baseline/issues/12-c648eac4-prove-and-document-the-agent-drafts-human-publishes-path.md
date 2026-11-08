# 12-c648eac4: Prove and document the agent-drafts, human-publishes path

**Spec:** docs/specs/baseline.md

**What to build:**

Create a scoped EmDash token (drafts only: no publish, no delete) for agents, stored as a secret, never in `.env` in git. Have an agent create a draft post through the EmDash MCP on staging containing: a heading, a Code Block Pro block, an image with alt text, filled SEO fields. James publishes it in the admin; verify the rendered page, the SEO output, the comments form and the validators. Repeat on production with a real (or unlisted) post James picks. Write `docs/publishing.md`: the exact steps and field requirements an agent follows, so people and agents share one documented path. Confirm the token can't publish.

**Blocked by:** 06-7a434f76, 08-2655a1e3, 10-eaea4d2b, 17-caadd917.

**Status:** ready-for-agent

- [ ] A draft created by an agent appears in the admin; the token's publish attempt is refused (output in a comment).
- [ ] The published page passes the validators and axe.
- [ ] `docs/publishing.md` exists and a fresh agent can follow it unaided.

## Comments

**2026-11-08 Claude (orchestrator):** Mermaid dropped from this ticket (James, 2026-11-08): Code Block Pro only highlights Mermaid source, and diagrams belong to the parked `emdash-plugin-diagrams` project.
