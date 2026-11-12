# Astro 7 and EmDash 1.5 upgrade

Read on 2026-11-12: [Astro 7 migration guide](https://docs.astro.build/en/guides/upgrade-to/v7/),
[Cloudflare adapter guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/),
[adapter changelog](https://github.com/withastro/astro/blob/main/packages/integrations/cloudflare/CHANGELOG.md),
[EmDash changelog](https://github.com/emdash-cms/emdash/blob/main/packages/core/CHANGELOG.md),
[seed files](https://docs.emdashcms.com/themes/seed-files/), and
[EmDash release-specific rollout instructions](https://docs.emdashcms.com/deployment/updating/#fixed-plugin-storage-uniqueness).
EmDash references were read through the documentation MCP.

Both apps and shared packages use Astro 7.4.10 and EmDash 1.5.0. Both apps use
Cloudflare adapter 14.4.7 and React integration 7.1.7. Astro 7.4.11 was still
inside the workspace's 24-hour release-age window when versions were selected.
The page builder moves to 0.3.0, which supports Astro 7.2.8 and later.
See [dependency overrides](dependency-overrides.md) for removed pins and audit findings.

## Compatibility decisions

- Astro 7 and adapter 14 use Vite 8. The old Cloudflare Vite plugin 1.39.0 pin
  is removed so the adapter can resolve its supported range.
- Both configs explicitly retain `compressHTML: true` to preserve Astro 6's
  inline spacing, rather than adopting the new JSX whitespace default.
- `output: "server"`, explicit `prerender = false` declarations, middleware,
  `Astro.rewrite` calls and cache-hint registration stay as they were. No
  `getStaticPaths` is introduced. The published-route unit assertions and
  HTTP discovery/404/preview assertions are unchanged.
- Posts and projects use Code Block Pro's registered `componentsEntry` via
  EmDash's automatic merge. The redundant, explicitly passed map was typed
  `Record<string, unknown>` by the plugin and no longer satisfied Portable Text's
  component type. The rendered fixture now also checks highlighted code and
  its copy button on a post and project; it keeps all existing route assertions.
- The native `$media.file` implementation replaces the EmDash 1.4 patch.
  The seed import test retains its path traversal and symlink assertions;
  only its expected diagnostic is widened for upstream's wording.
- Cloudflare Images remains the production image service. The local rendered
  media check loads every image and verifies original alt values.
- No experimental flags, custom Markdown processor, reserved `src/fetch.ts`,
  removed transition internals or container-renderer imports needed migration.
  The SEO plugin's entrypoint/admin-entry compatibility wrapper is retained.

## Migration rollout

The new migration-set fingerprint is the same for both apps:

```text
36ade5111fb27ab5a825b90e4bb60c3d7129d75e12a34f71d9b67d5cf2a5fc1b
```

EmDash 1.5 adds migrations 092–097: plugin KV options, orphan menu repair,
media-usage URL reindexing, plugin unique-index scope, revision kind/editors,
and co-editing room storage. Co-editing remains off by default; no room
bindings or feature opt-in are added.

**Before allowing the existing pre-deploy migration pipeline to run, inspect
tracked plugin storage unique indexes.** Migration 095 has a special rollout
requirement wherever these exist, including indexes from removed plugins.
The ordinary migrate-before-deploy sequence is unsuitable for that case:
older builds can recreate the old constraints. Follow upstream's maintenance
sequence: route traffic outside the app to maintenance, pause scheduled and
queued invocations, drain old invocations, deploy only the upgraded Worker in
`check` mode, apply and check migrations, then reopen traffic and scheduled work.
The upgrade does not itself establish that maintenance window or inspect remote D1.

D1 **target** fingerprints are separate from the migration-set fingerprint.
EmDash hashes only the account ID and database UUID, so upgrading EmDash does
not change them. These were calculated offline from the installed 1.5 target
algorithm, the repository's Wrangler configurations and ticket 07's recorded
account ID. The first three match existing GitHub variables; garden production
has no variable. They require remote status review before accepting any missing
variable; no remote D1 command or variable mutation was run here.

| Actions variable | Target fingerprint |
| --- | --- |
| `MARKETING_SITE_STAGING_MIGRATION_FINGERPRINT` | `89d4110ac8397c0fbcbc24f8ea4f4cfca0cc73dc83f35325ce18191aa0a99630` |
| `MARKETING_SITE_PRODUCTION_MIGRATION_FINGERPRINT` | `3553f9774e1eacfc5da6fe60ecbbf6ce67ce96a8a20c0d7da050acaff9b77b77` |
| `DIGITAL_GARDEN_STAGING_MIGRATION_FINGERPRINT` | `7784ec3673ef52ea3273bbd86878e842b864bf85b6c7c5a77727dc99036443b4` |
| `DIGITAL_GARDEN_PRODUCTION_MIGRATION_FINGERPRINT` | `7e410b725704a08d07930858e35dc188611c4555115f3e973cea87709f41f134` |

The deployment wrapper has no local mode. Its status invocation stops before
any network access without `CLOUDFLARE_ACCOUNT_ID`; both that outcome and its
isolated CLI-boundary tests are recorded in ticket 25's evidence. Local seed
imports execute the installed migrations against disposable SQLite/D1 databases.
Staging deployment and all staging smoke/SEO/media/accessibility checks remain
the orchestrator's handoff.
