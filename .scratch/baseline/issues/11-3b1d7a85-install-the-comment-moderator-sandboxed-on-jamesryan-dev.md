# 11-3b1d7a85: Install the comment moderator sandboxed on jamesryan.dev

**Spec:** docs/specs/baseline.md

**What to build:**

Install `emdash-plugin-ai-comment-moderation` from npm under `sandboxed: []` on jamesryan.dev, with its Workers AI credentials as Wrangler secrets (staging and production). Run the clean/spam/toxic check against staging, and add it to the staging smoke job if it can run without leaving test comments visible (clean up after itself).

**Blocked by:** 04-0c635224, 08-2655a1e3.

**Status:** ready-for-agent

- [ ] On staging, a clean comment is approved, spam is marked spam and toxic is held pending, shown in a comment with the API responses.
- [ ] Production promotion carries the plugin; its settings page loads in the admin.

## Comments
