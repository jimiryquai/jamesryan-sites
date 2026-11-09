# 11-3b1d7a85: Install the comment moderator sandboxed on jamesryan.dev

**Spec:** docs/specs/baseline.md

**What to build:**

Install `emdash-plugin-ai-comment-moderation` from npm under `sandboxed: []` on jamesryan.dev, with its Workers AI credentials as Wrangler secrets (staging and production). Run the clean/spam/toxic check against staging, and add it to the staging smoke job if it can run without leaving test comments visible (clean up after itself).

**Blocked by:** 04-0c635224, 08-2655a1e3, 19-e51d03d0.

**Status:** in progress (blocked by 19: the published plugin declares no settings)

- [ ] On staging, a clean comment is approved, spam is marked spam and toxic is held pending, shown in a comment with the API responses.
- [ ] Production promotion carries the plugin; its settings page loads in the admin.

## Comments

**2026-11-09 Claude (orchestrator):** Claimed. Risk: high (production plugin, the deploy smoke job, a credentialed check). Correction to the ticket: the plugin's Workers AI credentials are plugin settings in the admin (`settings:accountId`, `settings:apiToken`), not Wrangler secrets (ticket 04's finding), so James enters them on staging after deploy. h11-copilot (Copilot, GPT-6.1 Terra), branch `11-comment-moderator`, base `master`.

**2026-11-09 Claude (orchestrator):** h11-copilot stopped before building, and was right to: 2.0.0 declares no settings schema, so there's no admin form, and an API token stored outside a declared schema isn't encrypted. The orchestrator confirmed this in the plugin's `emdash-plugin.jsonc`. Split into 19-e51d03d0 (declare the settings, release 2.1.0). Once that's published, this ticket installs 2.1.0, and the deploy needs `EMDASH_ENCRYPTION_KEY` as a Worker secret on staging and production, backed up outside the database (James sets it through the wizard), before the token is entered. The worktree `11-comment-moderator` stays for the resumed run. Evidence: `.orchestrate/runs/2026-11-09-11-comment-moderator/`.
