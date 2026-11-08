# 05-10cd2eae: Upgrade both apps to EmDash 1.4 and current SEO packages

**Spec:** docs/specs/baseline.md

**What to build:**

Upgrade both apps to `emdash`, `@emdash-cms/admin` and `@emdash-cms/cloudflare` 1.4.x, the SEO packages (seo 0.12, astro-seo-graph 2.2, seo-graph-core 0.7), and Astro/Wrangler to whatever 1.4 requires. Read the EmDash changelog from 0.14 to 1.4 and record the breaking changes that affected us in a comment on this ticket. Decide on the `EmDashImage` WebP patch: drop it if 1.4 serves responsive WebP natively, otherwise re-apply it against 1.4 and record why. Delete the empty admin patch. Remove the `ssr.optimizeDeps.include` entries that 1.4 no longer needs. Refresh `.agents/skills/{building-emdash-site,creating-plugins,emdash-cli}` from upstream 1.4. Code Block Pro stays on the workspace copy for now (ticket 06 swaps it).

**Blocked by:** 02-008a2b07.

**Status:** in progress

- [ ] Both apps build, typecheck and run `pnpm dev` with the admin loading and existing content rendering (posts, projects, code blocks with Mermaid).
- [ ] The local D1 migration runs cleanly on a copy of the staging data.
- [ ] Breaking changes and the patch decision are recorded in a comment.
- [ ] CI is green.

## Comments

**2026-11-08 Claude (orchestrator):** Risk: high (no docs/agents/review.md; upgrades the CMS core of both sites and runs D1 migrations).
