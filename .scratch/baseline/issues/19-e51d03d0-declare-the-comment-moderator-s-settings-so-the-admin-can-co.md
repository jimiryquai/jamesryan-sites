# 19-e51d03d0: Declare the comment moderator's settings so the admin can configure it

**Spec:** docs/specs/baseline.md

**What to build:**

Found by ticket 11 (2026-11-09). `emdash-plugin-ai-comment-moderation@2.0.0` (repo `../emdash-plugin-ai-comment-moderation`) reads `settings:accountId`, `settings:apiToken` and `settings:model`, but its `emdash-plugin.jsonc` declares no settings, so:

- the admin shows no settings page to enter them;
- an API token stored outside a declared schema isn't encrypted ("Values stored outside a declared settings schema … do not use this encryption path", https://docs.emdashcms.com/deployment/secrets/);
- without them, the plugin's fallback classifies nothing as spam.

Ticket 04's tests set the values through the test host directly (`fixtures.plugin.setting(...)`), which hid the gap.

1. Declare the three settings the way EmDash 1.4 documents it (https://docs.emdashcms.com/plugins/creating-plugins/settings/, read through mcporter): `accountId` (text), `apiToken` as `type: "secret"`, and `model` with its current default `@cf/meta/llama-3.1-8b-instruct`. The plugin reads them through `ctx.settings`, keeping its legacy KV fallback if the docs say an upgrade needs it.
2. A test, run through the production Cloudflare sandbox runner the repo already uses, shows the declared schema, and shows the plugin classifying with values saved through it. A test that the token never appears in logs is welcome.
3. README: the settings page replaces the "KV-Driven Configuration" text. Note that the site needs `EMDASH_ENCRYPTION_KEY` (with a backup outside the database) before the token is entered.
4. Release as 2.1.0 through the repo's existing release PR and trusted-publishing workflow. James merges the release PR.

**Blocked by:** none.

**Status:** needs James: merge jimiryquai/emdash-plugin-ai-comment-moderation#3, then create the `v2.1.0` GitHub release (publishes to npm)

- [x] The plugin's manifest declares `accountId`, `apiToken` (secret) and `model`, and a sandbox test proves classification with values from the declared settings.
- [ ] 2.1.0 is on npm with provenance.

## Comments

**2026-11-09 Claude (orchestrator):** Created from h11-copilot's blocked report; the orchestrator confirmed it in the plugin repo (`emdash-plugin.jsonc` has no settings). Risk: high (a published package, a credential field). Ticket 11 is blocked by this.

**2026-11-09 Claude (orchestrator):** Built by h19-copilot (Copilot, GPT-6.1 Terra) in herdr workspace `emdash-plugin-ai-comment-moderation`. PR #3 (42f191d) declares `accountId` (string), `apiToken` (secret) and `model` (string, default `@cf/meta/llama-3.1-8b-instruct`) under `admin.settingsSchema`, and reads them through `ctx.settings`. A new sandbox test saves the values through `updateSettings`, sees `secretsSet.apiToken: true` with no plaintext token in the response, and classifies spam with the saved token and model; it was red before the schema. The orchestrator re-ran `npm ci`, typecheck, build (2.1.0) and tests (34 pass), and every PR check is green. Box 2 waits on James's merge and release.
