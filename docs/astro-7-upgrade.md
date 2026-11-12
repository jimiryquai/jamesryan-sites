# Astro 7 and EmDash 1.5 upgrade

Read on 2026-11-12: [Astro 7 migration guide](https://docs.astro.build/en/guides/upgrade-to/v7/),
[Cloudflare adapter guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/),
[adapter changelog](https://github.com/withastro/astro/blob/main/packages/integrations/cloudflare/CHANGELOG.md),
[EmDash changelog](https://github.com/emdash-cms/emdash/blob/main/packages/core/CHANGELOG.md),
[seed files](https://docs.emdashcms.com/themes/seed-files/), and
[EmDash release-specific rollout instructions](https://docs.emdashcms.com/deployment/updating/#fixed-plugin-storage-uniqueness).
EmDash references were read through the documentation MCP.

Both apps and shared packages use Astro 7 and EmDash 1.5; both apps use
Cloudflare adapter 14. Exact dependency versions live in each `package.json`
and the shared lockfile. See [dependency overrides](dependency-overrides.md)
for the remaining audit findings.

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

EmDash 1.5 adds migrations 092–097: plugin KV options, orphan menu repair,
media-usage URL reindexing, plugin unique-index scope, revision kind/editors,
and co-editing room storage. Co-editing remains off by default; no room
bindings or feature opt-in are added.

When a database has tracked plugin storage unique indexes, including indexes
from removed plugins, migration 095 requires a maintenance rollout. The ordinary
migrate-before-deploy sequence is unsuitable for that case: older builds can
recreate the old constraints. Follow [EmDash's maintenance instructions](https://docs.emdashcms.com/deployment/updating/#fixed-plugin-storage-uniqueness):
route traffic outside the app to maintenance, pause scheduled and queued work,
drain old invocations, deploy only the upgraded Worker in `check` mode, apply
and check migrations, then reopen traffic and scheduled work.

D1 target fingerprints are separate from the migration-set fingerprint.
EmDash hashes only the account ID and database UUID, so upgrading EmDash does
not change a target's identity. For the authoritative variable names and the
status-review procedure, see [Reviewed target fingerprints](deploying.md#reviewed-target-fingerprints).
Each build emits its migration-set identity in `.emdash/migrations.json`.
