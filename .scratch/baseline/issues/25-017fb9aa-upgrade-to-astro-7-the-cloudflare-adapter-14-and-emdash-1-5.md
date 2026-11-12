# 25-017fb9aa: Upgrade to Astro 7, the Cloudflare adapter 14 and EmDash 1.5

**Spec:** none.

**What to build:**

Astro <7.2.8 has a critical advisory, "Remote code execution through AVIF image optimization", fixed only in Astro 7 (latest 7.4.11 on 2026-11-12). The site pins `astro` 6.4.8, `@astrojs/cloudflare` 13.7.0 and `emdash` 1.4.0 (both apps).

- `@astrojs/cloudflare` 14.4.7 needs `astro ^7.4.0`.
- EmDash 1.5.0 accepts `astro >=6`.
- `emdash-plugin-page-builder` 0.2.0 requires `astro ^6.4.8`, so the site can't move until the page builder ships 0.3.0 with a widened range (page-builder ticket v1/22-6f8475dd). `emdash-plugin-code-block-pro` 0.2.0 and `emdash-plugin-ai-comment-moderation` 2.1.0 don't constrain Astro.

1. Upgrade both apps to Astro 7, `@astrojs/cloudflare` 14 and EmDash 1.5, following each project's upgrade guide (read through the docs MCP and the packages' changelogs; cite what you rely on).
2. Check EmDash 1.5's migrations against the deploy pipeline: `scripts/migrate-deployment.sh` and the staging and production fingerprint variables will need new targets. Name the new fingerprints; the orchestrator sets the variables.
3. Check whether EmDash 1.5 ships the `$media` `file:` seed option, and if so remove `patches/emdash@1.4.0.patch` (backlog item).
4. Remove any `pnpm.overrides` from ticket 24 that the upgrade makes unnecessary.

**Blocked by:** 24-1e3128bf.

**Status:** done

- [x] Both apps run Astro 7, `@astrojs/cloudflare` 14 and EmDash 1.5; `pnpm audit` shows no Astro advisory (output in a comment).
- [x] CI passes, staging deploys through the migration pipeline with the new fingerprints, and the smoke, rendered SEO, media and accessibility checks pass there (output in a comment).

## Comments

**2026-11-12 Claude (orchestrator):** Raised from James's request (Astro security advisories, not urgent), relayed by the page-builder session with versions checked by the orchestrator on npm. Kept at `needs-triage` until page-builder 0.3.0 is on npm, since the tracker can't see another repo's ticket. Risk: high (framework upgrade and new migrations on both apps, through the deploy pipeline).

**2026-11-12 Claude (orchestrator):** Unblocked: 24 done (dc101c4), page-builder 0.3.0 on npm with peer `astro ^6.4.8 || ^7.2.8` (checked on npm). Builder Codex Sol; risk high stands.

**2026-11-12 Claude (orchestrator):** Done. Built by h25-codex (Codex, GPT-6.1 Sol) with 1 fix round, PR #29, merged to master as 33227ca.
- **Versions and audit:** Astro 7.4.10 (7.4.11 was inside the 24-hour release-age window), @astrojs/cloudflare 14.4.7 and EmDash 1.5.0 in both apps, with page-builder 0.3.0. `pnpm audit` shows no Astro advisory. What remains: zod 3 (no patched 3.x release, through the SEO plugin) and Satori bundled in workers-og.
- **Removed:** the `$media` patch, because 1.5 supports it natively, and all six ticket-24 overrides.
- **Telemetry:** the fix round found Wrangler 4.110+'s dependency-upload metadata, which isn't covered by `WRANGLER_SEND_METRICS`. Both Wrangler configs now set `dependencies_instrumentation.enabled: false` and `send_metrics: false`.
- **Review:** Standards and Spec reviewers. Their findings were fixed in round 1: stale 1.4 docs, evidence pointers outside the repo, duplicated facts, the release-age entry, and a garden Code Block Pro check that was missing (now in CI). The orchestrator re-ran CI on both rounds (exit 0).
- **Migration 095:** the orchestrator read both staging databases before merging: 0 rows in `_plugin_indexes`, so 095 had nothing to repair and the normal pipeline was safe. The D1 target fingerprints are unchanged (account plus database UUID), so no variables changed.
- **Box 2, on staging after the deploy:** 092 to 097 were executed on both staging databases, with nothing pending (`staging-migrations.json`). Smoke passed for both apps. Accessibility passed with `{"seriousCriticalIssues":0,"pageModeChecks":30,"commentFields":"PASS"}`. The 12 sitemap paths return 200 and the unlaunched routes 404. All 23 images on the key pages load, and Code Block Pro renders the copy button. `validate-rendered-seo.mjs` output is identical to before the upgrade (content findings only).
- **Before promoting to production:** check production's `_plugin_indexes` for `uidx_plugin_%` rows. If there are any, use EmDash's maintenance rollout (`docs/astro-7-upgrade.md`).
- Evidence: `.orchestrate/runs/2026-11-12-25-astro-7/`.

