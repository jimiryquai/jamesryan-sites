# 11-3b1d7a85: Install the comment moderator sandboxed on jamesryan.dev

**Spec:** docs/specs/baseline.md

**What to build:**

Install `emdash-plugin-ai-comment-moderation` from npm under `sandboxed: []` on jamesryan.dev, with its Workers AI credentials as Wrangler secrets (staging and production). Run the clean/spam/toxic check against staging, and add it to the staging smoke job if it can run without leaving test comments visible (clean up after itself).

**Blocked by:** 04-0c635224, 08-2655a1e3.

**Status:** in progress

- [ ] On staging, a clean comment is approved, spam is marked spam and toxic is held pending, shown in a comment with the API responses.
- [ ] Production promotion carries the plugin; its settings page loads in the admin.

## Comments

**2026-11-09 Claude (orchestrator):** Claimed. Risk: high (production plugin, the deploy smoke job, a credentialed check). Correction to the ticket: the plugin's Workers AI credentials are plugin settings in the admin (`settings:accountId`, `settings:apiToken`), not Wrangler secrets (ticket 04's finding), so James enters them on staging after deploy. h11-copilot (Copilot, GPT-6.1 Terra), branch `11-comment-moderator`, base `master`.
