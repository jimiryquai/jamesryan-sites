# 24-1e3128bf: Clear the dependency audit findings that don't need Astro 7

**Spec:** none.

**What to build:**

James wants the site's security advisories cleared (2026-11-12, not urgent). `pnpm audit` on master (2026-11-12, after #25) reports 4 critical, 55 high, 78 moderate and 22 low. Astro's own critical advisory ("Remote code execution through AVIF image optimization", astro <7.2.8) needs Astro 7, which is ticket 25. Most of the rest are transitive and fixable on Astro 6:

- critical: seroval (>=1.6.2), proxy-addr (>=2.0.8), dompurify (>=3.4.17);
- high, among others: devalue, svgo, vite 7.x, @modelcontextprotocol/sdk, zod, body-parser, smol-toml, prosemirror-view, undici, @tiptap/core, hono, fast-uri, source-map-js, js-yaml, sharp, browserslist, ip-address, nanoid, postcss, ws.

1. Raise each to a patched version by updating its direct parent where one exists; use a `pnpm.overrides` entry only where no parent release carries the fix, with a comment naming the advisory, so each override can be removed later. Keep the repo's release-age rule (`minimumReleaseAgeExclude` only for what it already exempts).
2. Find the source of each finding with `pnpm why`. A finding that only a dev tool pulls in (it never ships in the Worker) still gets fixed if a patched version exists, but say which side it's on.
3. Record what's left after this ticket, and why (needs Astro 7, no patched release, or the patch breaks something), in the ticket comment, with the audit output.

Out of scope: Astro, `@astrojs/cloudflare` and EmDash major or minor upgrades (ticket 25); the garden's own dependencies only as far as the shared lockfile carries them.

**Blocked by:** none.

**Status:** done

- [x] `pnpm audit` on the branch shows no critical or high finding except those that need Astro 7 or have no patched release, each listed with its reason (audit output before and after in a comment).
- [x] CI passes, and staging after deploy passes the smoke, rendered SEO and accessibility checks (output in a comment).

## Comments

**2026-11-12 Claude (orchestrator):** Raised from James's request, relayed by the page-builder session; the orchestrator re-ran `pnpm audit` on master's lockfile to confirm the counts. Split from ticket 25 because most findings don't wait on Astro 7. Risk: medium (lockfile-wide dependency changes; CI and staging cover them).

**2026-11-12 Claude (orchestrator):** Done. Built by h24-codex (Codex, GPT-6.1 Sol) in 1 round, PR #26, merged to master as dc101c4.
- The orchestrator re-ran `pnpm audit` on the branch: 1 critical (astro, ticket 25) and 1 high (zod 3, no patched 3.x release).
- It also re-ran CI's steps (exit 0) and read the manifest and overrides diff. There are five overrides, each with its advisory and removal condition in `docs/dependency-overrides.md`, and the Tiptap pins are removed.
- Staging, deploy run 43216282820: smoke passed for both apps, and accessibility had `{"seriousCriticalIssues":0,"pageModeChecks":30,"commentFields":"PASS"}` across light and dark. `validate-rendered-seo.mjs` output is identical to the pre-24 staging run (content findings only, see ticket 23).
- Evidence: `.orchestrate/runs/2026-11-12-24-audit-fixes/`.

Helper's audit table:

# Ticket 24-1e3128bf dependency audit

Before: `{"info":0,"low":22,"moderate":78,"high":55,"critical":4}`.
After: `{"info":0,"low":1,"moderate":5,"high":1,"critical":1}`.

Raw audits: .orchestrate/evidence/audit-before.json and audit-after.json. Dependency provenance: .orchestrate/evidence/why-<package>.txt (one pnpm why call per package), plus the combined why-after.txt; why-before-<package>.txt records every original pnpm why source (replayed from the initial commit in a temporary checkout); audit-before.json also records the original paths/versions. npm registry metadata and publication dates are saved as metadata-*.json. All selected releases are older than 24 hours; no exclusions changed.

| Package | Severity before | Fixed by | Worker or dev only; representative source |
| --- | --- | --- | --- |
| @babel/core | low | upgrade within existing ranges | dev/build only; `@astrojs/react>@vitejs/plugin-react>@babel/core` |
| @hono/node-server | moderate | upgrade within existing ranges | Worker dependency graph (Node transport; may be tree-shaken); `emdash>@modelcontextprotocol/sdk>@hono/node-server` |
| @modelcontextprotocol/sdk | high, moderate | upgrade within existing ranges | Worker/runtime or shipped admin assets; `emdash>@modelcontextprotocol/sdk` |
| @tiptap/core | moderate, high | upgrade within existing ranges | Worker/runtime or shipped admin assets; `@emdash-cms/admin>@tiptap/core` |
| astro | moderate, low, critical | not fixed: needs Astro 7 (ticket 25) | Worker/runtime or shipped admin assets; `astro` |
| baseline-browser-mapping | moderate | upgrade within existing ranges | dev/build only; `@astrojs/react>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist>baseline-browser-mapping` |
| body-parser | low, high | upgrade within existing ranges | Worker dependency graph (Node transport; may be tree-shaken); `emdash>@modelcontextprotocol/sdk>express>body-parser` |
| browserslist | high | upgrade within existing ranges | dev/build only; `@astrojs/react>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist` |
| deepmerge | low | upgrade within existing ranges | Worker/runtime or shipped admin assets; `emdash>sanitize-html>deepmerge` |
| devalue | moderate, high, low | upgrade within existing ranges | Worker/runtime or shipped admin assets; `@astrojs/react>devalue` |
| dompurify | moderate, low, critical, high | upgrade within existing ranges | Worker/runtime or shipped admin assets; `@emdash-cms/admin>dompurify` |
| esbuild | low | override (see docs/dependency-overrides.md) | dev/build only; `@tailwindcss/vite>vite>esbuild` |
| fast-uri | high, moderate, low | upgrade within existing ranges | dev/build only; `@astrojs/check>@astrojs/language-server>volar-service-yaml>yaml-language-server>ajv>fast-uri` |
| fflate | moderate | upgrade within existing ranges in resolved graph; workers-og embedded bundle unchanged | Worker/runtime or shipped admin assets; `workers-og>satori>@shuding/opentype.js>fflate` |
| hono | moderate, high, low | upgrade within existing ranges | Worker/runtime or shipped admin assets; `emdash>@modelcontextprotocol/sdk>hono` |
| ip-address | high, moderate | upgrade within existing ranges | Worker dependency graph (Node transport; may be tree-shaken); `emdash>@modelcontextprotocol/sdk>express-rate-limit>ip-address` |
| js-yaml | moderate, high | upgrade within existing ranges | dev/build only; `@astrojs/cloudflare>@astrojs/internal-helpers>js-yaml` |
| nanoid | high | upgrade within existing ranges | dev/build only; `@tailwindcss/vite>vite>postcss>nanoid` |
| postcss | moderate, high | upgrade within existing ranges | dev/build only; `@tailwindcss/vite>vite>postcss` |
| prosemirror-view | high | upgrade within existing ranges | Worker/runtime or shipped admin assets; `@emdash-cms/admin>@tiptap/pm>prosemirror-view` |
| proxy-addr | critical | upgrade within existing ranges | Worker dependency graph (Node transport; may be tree-shaken); `emdash>@modelcontextprotocol/sdk>express>proxy-addr` |
| qs | moderate | upgrade within existing ranges | Worker dependency graph (Node transport; may be tree-shaken); `emdash>@modelcontextprotocol/sdk>express>qs` |
| sanitize-html | moderate | upgrade within existing ranges | Worker/runtime or shipped admin assets; `emdash>sanitize-html` |
| satori | moderate | not fixed: workers-og bundles Satori; no patched parent release | Worker/runtime or shipped admin assets; `workers-og>satori` |
| seroval | critical, high | upgrade within existing ranges | Worker/runtime or shipped admin assets; `@emdash-cms/admin>@tanstack/react-router>@tanstack/router-core>seroval` |
| sharp | high | override (see docs/dependency-overrides.md) | dev/build only; `wrangler>miniflare>sharp` |
| smol-toml | high, moderate | upgrade within existing ranges | dev/build only; `@astrojs/cloudflare>@astrojs/internal-helpers>smol-toml` |
| source-map-js | high | upgrade within existing ranges | dev/build only; `@tailwindcss/vite>@tailwindcss/node>source-map-js` |
| svgo | high, moderate | upgrade within existing ranges | dev/build only; `astro>svgo` |
| undici | high, moderate, low | override (see docs/dependency-overrides.md) | dev/build only; `wrangler>miniflare>undici` |
| valibot | moderate | upgrade within existing ranges | Worker/runtime or shipped admin assets; `@emdash-cms/admin>@emdash-cms/registry-client>@atcute/identity-resolver>valibot` |
| vite | moderate, high, low | upgrade within existing ranges | dev/build only; `@tailwindcss/vite>vite` |
| ws | high | override (see docs/dependency-overrides.md) | dev/build only; `wrangler>miniflare>ws` |
| yaml | moderate | upgrade within existing ranges | dev/build only; `@astrojs/check>@astrojs/language-server>volar-service-yaml>yaml-language-server>yaml` |
| zod | high | override fixes 4.x; 3.25.76 not fixed: no patched 3.x release (parent SEO plugin 0.12.0 is latest) | Worker/runtime or shipped admin assets; `.>@jdevalk/astro-seo-graph>zod` |

Classification follows pnpm why and usage: Cloudflare Vite plugin/Miniflare/Wrangler execute locally or during builds even where the adapter is a production dependency. Sharp is not used for production image processing (Cloudflare Images). Admin packages ship browser assets; EmDash, Hono, serializers and SEO validation also enter the Worker graph. MCP SDK appears in both mcporter (dev) and EmDash (runtime). Full paths, including multiple parents, are in why-after.txt.

Remaining advisories:

- astro: moderate, https://github.com/advisories/GHSA-f48w-9m4c-m7f5; patched >=7.0.6. Requires deferred Astro 7.
- astro: low, https://github.com/advisories/GHSA-7pw4-f3q4-r2p2; patched >=7.0.4. Requires deferred Astro 7.
- astro: moderate, https://github.com/advisories/GHSA-4g3v-8h47-v7g6; patched >=7.1.0. Requires deferred Astro 7.
- astro: critical, https://github.com/advisories/GHSA-26w7-cxv4-gfx2; patched >=7.2.8. Requires deferred Astro 7.
- astro: moderate, https://github.com/advisories/GHSA-376h-93r7-7g6f; patched >=7.2.4. Requires deferred Astro 7.
- astro: moderate, https://github.com/advisories/GHSA-98hj-9722-w3j8; patched >=7.3.2. Requires deferred Astro 7.
- zod: high, https://github.com/advisories/GHSA-mrhx-c7xc-m3w5; patched >=4.6.6. No eligible patched Zod 3 release; the SEO plugin pins astro-seo-graph 0.7.0 which requires Zod 3. Forcing Zod 4 would cross the parent API contract. No eligible parent release (SEO 0.12.0 is latest).
- satori: moderate, https://github.com/advisories/GHSA-wx4j-mvgx-mqwp; patched >=0.33.5. No patched workers-og parent; a manifest override leaves its bundled Satori unchanged.

Marketing Wrangler upgraded directly to 4.160.0 with matching workers-types 5.20261110.1; garden manifests are unchanged, receiving shared-lockfile/override fixes only. Five overrides cover parents held by the ticket-25 constraints. Removed Tiptap extension pins to follow patched 3.x core. No plugin range widened. Telemetry disabled with the brief’s two environment variables; Wrangler npm update checking already existed before the upgrade.

Staging smoke, rendered SEO and accessibility remain the orchestrator’s post-merge/deploy responsibility. This helper makes no staging or production writes.

Final checks all passed: pnpm install --frozen-lockfile, pnpm typecheck, pnpm build, pnpm test (48 root + 6 cms-helpers, zero failures), bash scripts/check-rendered-seo.sh. Raw logs: install.log, typecheck-final.log, build-final.log, test.log, rendered-seo.log under .orchestrate/evidence/.

PR: https://github.com/jimiryquai/jamesryan-sites/pull/26 (master target). gh pr checks 26 reports:

```text
Socket Security: Project Report	pass	4s	https://socket.dev/dashboard/org/james-ryan/sbom/1453b386-d35a-4c62-b9d7-a4cda1bf5a35	
Socket Security: Pull Request Alerts	pass	9s	https://socket.dev	
Typecheck, build and test	pass	2m57s	https://github.com/jimiryquai/jamesryan-sites/actions/runs/43214863088/job/131171386534	
```

Raw CI output: .orchestrate/evidence/ci.log; review-standards.md and review-spec.md have no unresolved findings.

