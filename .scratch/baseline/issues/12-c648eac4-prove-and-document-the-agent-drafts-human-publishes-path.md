# 12-c648eac4: Prove and document the agent-drafts, human-publishes path

**Spec:** docs/specs/baseline.md

**What to build:**

Create a scoped EmDash token (drafts only: no publish, no delete) for agents, stored as a secret, never in `.env` in git. Have an agent create a draft post through the EmDash MCP on staging containing: a heading, a Code Block Pro block, an image with alt text, filled SEO fields. James publishes it in the admin; verify the rendered page, the SEO output, the comments form and the validators. Repeat on production with a real (or unlisted) post James picks. Write `docs/publishing.md`: the exact steps and field requirements an agent follows, so people and agents share one documented path. Confirm the token can't publish.

**Blocked by:** 06-7a434f76, 08-2655a1e3, 10-eaea4d2b, 17-caadd917.

**Status:** done

- [x] A draft created by an agent appears in the admin; the token's publish attempt is refused (output in a comment).
- [x] The published page passes the validators and axe.
- [x] `docs/publishing.md` exists and a fresh agent can follow it unaided.

## Comments

**2026-11-08 Claude (orchestrator):** Mermaid dropped from this ticket (James, 2026-11-08): Code Block Pro only highlights Mermaid source, and diagrams belong to the parked `emdash-plugin-diagrams` project.

**2026-11-09 Claude (orchestrator):** h12-copilot (Copilot, GPT-6.1 Terra), PR #22 (f9884ec, 50b55e7, f20d6e6) merged to `master`. Its first run stopped correctly: the token in use published the fixture. The orchestrator traced that in staging D1: the token "Agent Content Media" was owned by James's Admin account (role 50), having been created while the admin's passkey signed him in as himself. With James's approval (auto mode off), the orchestrator:
- deleted that token;
- minted "Agent drafts (Contributor)" for `agent@jamesryan.dev` (role 20) with EmDash's own `generatePrefixedToken`, storing only its hash, and wrote the raw token to `.env` unseen;
- moved the published fixture to draft and the trash.

The Agent account has no passkey; it's a token-only service account. Fix round 1, with the new token: the draft `agent-test-contributor-publishing-path` was created through MCP (authored by agent@jamesryan.dev). `content_publish` and `content_delete` both returned `[INSUFFICIENT_PERMISSIONS] Insufficient permissions for this operation`. `docs/publishing.md` now starts with a required check of the token's owner and role from D1. MCP: `emdash-staging-agent` in `config/mcporter.json` (mcporter HTTP, Bearer from the environment). Evidence: `.orchestrate/runs/2026-11-09-12-agent-drafts/`.

**2026-11-09 Claude (orchestrator):** James published the agent's draft on staging. `https://staging.jamesryan.dev/posts/agent-test-contributor-publishing-path`: 200, title 46 characters, description 86, one H1, 4 images all with alt text, the Code Block Pro block rendered, the comment form present, and the canonical URL correct. `scripts/validate-rendered-seo.mjs https://staging.jamesryan.dev` (14 pages) reports nothing for this post; its failures are the known ticket 18 content findings. `scripts/check-accessibility.mjs https://staging.jamesryan.dev`: 0 serious or critical issues on this post, light and dark. Still to do: box 3 (a fresh agent follows the guide unaided) and the production repeat.

**2026-11-12 Gemini (agy Carbon, orchestrator):** Box 3 passed unaided. Fresh cold sub-agent (`14cd73df`, zero context, reading only `docs/publishing.md` and linked `docs/mcp.md`) ran the D1 token-owner preflight (`PASS`, `agent@jamesryan.dev`, role 20), uploaded a 1x1 PNG (`01M78FVG9YMFN5GSGKSBC3DWY1`), created draft post `01M78FWY2GV50ZMNPSMP36628X` (`agent-unaided-box3-publishing-check`, `status: "draft"`, with H2 heading, `code-block-pro`, image with alt text, 55-char rendered SEO title and 153-char SEO description), verified it with `content_get`, and confirmed `content_publish` fails with `[INSUFFICIENT_PERMISSIONS] Insufficient permissions for this operation` on the first attempt with no workarounds. Evidence: `.orchestrate/runs/2026-11-09-12-agent-drafts/box3-unaided-cold-read.md`. Only the production repeat (once James picks a post) remains.

**2026-11-13 Gemini (agy Carbon, orchestrator):** James waived the redundant production test-post repeat (2026-11-13: staging already proved the full Contributor-scoped MCP draft → refused publish/delete → human admin publish → rendered SEO/axe/Code Block Pro/comments path end to end, and all 3 acceptance boxes are complete). Closing ticket as `done`.
