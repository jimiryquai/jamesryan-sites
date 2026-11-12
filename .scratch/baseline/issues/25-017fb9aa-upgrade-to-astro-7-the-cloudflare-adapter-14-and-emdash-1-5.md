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

**Blocked by:** 24-1e3128bf; emdash-plugin-page-builder v1/22-6f8475dd (0.3.0 on npm with a widened Astro peer range).

**Status:** needs-triage

- [ ] Both apps run Astro 7, `@astrojs/cloudflare` 14 and EmDash 1.5; `pnpm audit` shows no Astro advisory (output in a comment).
- [ ] CI passes, staging deploys through the migration pipeline with the new fingerprints, and the smoke, rendered SEO, media and accessibility checks pass there (output in a comment).

## Comments

**2026-11-12 Claude (orchestrator):** Raised from James's request (Astro security advisories, not urgent), relayed by the page-builder session with versions checked by the orchestrator on npm. Kept at `needs-triage` until page-builder 0.3.0 is on npm, since the tracker can't see another repo's ticket. Risk: high (framework upgrade and new migrations on both apps, through the deploy pipeline).
