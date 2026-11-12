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

**Status:** ready-for-agent

- [ ] `pnpm audit` on the branch shows no critical or high finding except those that need Astro 7 or have no patched release, each listed with its reason (audit output before and after in a comment).
- [ ] CI passes, and staging after deploy passes the smoke, rendered SEO and accessibility checks (output in a comment).

## Comments

**2026-11-12 Claude (orchestrator):** Raised from James's request, relayed by the page-builder session; the orchestrator re-ran `pnpm audit` on master's lockfile to confirm the counts. Split from ticket 25 because most findings don't wait on Astro 7. Risk: medium (lockfile-wide dependency changes; CI and staging cover them).
