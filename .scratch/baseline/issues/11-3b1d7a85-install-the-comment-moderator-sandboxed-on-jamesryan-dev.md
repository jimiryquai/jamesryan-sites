# 11-3b1d7a85: Install the comment moderator sandboxed on jamesryan.dev

**Spec:** docs/specs/baseline.md

**What to build:**

Install `emdash-plugin-ai-comment-moderation` from npm under `sandboxed: []` on jamesryan.dev, with its Workers AI credentials as Wrangler secrets (staging and production). Run the clean/spam/toxic check against staging, and add it to the staging smoke job if it can run without leaving test comments visible (clean up after itself).

**Blocked by:** 04-0c635224, 08-2655a1e3, 19-e51d03d0.

**Status:** needs James: run the wizard's encryption-key stage for the marketing Workers, then enter the Workers AI account ID and token on the moderator's settings page in the staging admin

- [ ] On staging, a clean comment is approved, spam is marked spam and toxic is held pending, shown in a comment with the API responses.
- [ ] Production promotion carries the plugin; its settings page loads in the admin.

## Comments

**2026-11-09 Claude (orchestrator):** Claimed. Risk: high (production plugin, the deploy smoke job, a credentialed check). Correction to the ticket: the plugin's Workers AI credentials are plugin settings in the admin (`settings:accountId`, `settings:apiToken`), not Wrangler secrets (ticket 04's finding), so James enters them on staging after deploy. h11-copilot (Copilot, GPT-6.1 Terra), branch `11-comment-moderator`, base `master`.

**2026-11-09 Claude (orchestrator):** h11-copilot stopped before building, and was right to: 2.0.0 declares no settings schema, so there's no admin form, and an API token stored outside a declared schema isn't encrypted. The orchestrator confirmed this in the plugin's `emdash-plugin.jsonc`. Split into 19-e51d03d0 (declare the settings, release 2.1.0). Once that's published, this ticket installs 2.1.0, and the deploy needs `EMDASH_ENCRYPTION_KEY` as a Worker secret on staging and production, backed up outside the database (James sets it through the wizard), before the token is entered. The worktree `11-comment-moderator` stays for the resumed run. Evidence: `.orchestrate/runs/2026-11-09-11-comment-moderator/`.

**2026-11-09 Claude (orchestrator):** Merged. h11-copilot (Copilot, GPT-6.1 Terra) built PR #21 (2c1e438); the orchestrator merged master in (re-resolving the lockfile with the EmDash patch, 753b397), and it merged to `master` as a5d5e09. It installs `emdash-plugin-ai-comment-moderation@2.1.0` pinned, sandboxed on the marketing site, and the sandbox log shows it loaded with `[network:request, users:read]`. It also adds:
- `scripts/check-comment-moderation.mjs`: clean → approved, spam → spam, toxic → pending, deleting each test comment;
- a staging smoke step that runs only when `EMDASH_COMMENT_SMOKE_TOKEN` is set;
- an encryption-key stage in the wizard, with the other stages skippable.

The local run against stubbed Workers AI gave approved, spam and pending, the 3 test comments were deleted, and the settings page rendered all three fields. The orchestrator re-ran typecheck, build, test (38 pass) and the rendered check on the merged tree; PR CI was green. Still to do, by James: generate each Worker's `EMDASH_ENCRYPTION_KEY` with the wizard (and save it in a password manager), then enter the Workers AI settings in the staging admin. Then box 1 runs. That needs either James running the check locally with an admin token, or the optional `EMDASH_COMMENT_SMOKE_TOKEN` GitHub secret: a staging admin-scope token, which is James's decision.
