# 09-b9733862: Consolidate to one olive palette meeting WCAG 2.2 AA

**Spec:** docs/specs/baseline.md

**What to build:**

Make the olive scale in `tailwind.css` the one palette: one token file, used everywhere. Delete the indigo and pink tokens in `src/styles/theme.css` and `globals.css` and every use of them; pick an accent from the olive design or ask James. Check every text/background pair in light and dark modes against WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI). Fix failures by changing lightness, not hue. Add axe (`@axe-core/playwright` or `pa11y-ci`) plus a contrast check to the staging smoke job, failing on serious or critical issues. Apply the same to the garden. The comment form's fields must stand apart from the page background (a distinct fill, plus a border meeting 3:1 under WCAG 1.4.11), light and dark, with a visible focus state (James, 2026-11-09). Produce before/after screenshots of the home page, a post, the comment form and the admin-facing pages for James.

**Blocked by:** 05-10cd2eae, 08-2655a1e3.

**Status:** done

- [x] One palette definition per app (or one shared in `packages/ui`), with no `#6366f1`/`#f472b6` left (`grep` proves it).
- [x] axe reports zero serious/critical issues on the staging pages, light and dark, in CI.
- [x] Before/after screenshots attached; status `needs James` until he approves the look.

## Comments

**2026-11-09 Claude (orchestrator):** Claimed. Risk: high (CI definition: axe in the staging smoke job). Scope: the marketing site only, since James has put the garden out of scope for now; the accent comes from the olive design and James approves the look from screenshots. h09-codex (Codex, GPT-6.1 Sol), branch `09-olive-palette`, base `master`.

**2026-11-09 Claude (orchestrator):** Merged: PR #18 (f3a5f48, 0f83fe0, 48fd2d6, db0937b) to `master` as 3214558, after 1 fix round. The fix round deleted a leftover second palette in an unused `tailwind.css` and gave olive-500 back its own lightness (52%, against 600's 46.6%). The orchestrator re-ran install, typecheck, build, test (24 pass) and the rendered SEO check; no indigo or pink remains. The olive palette lives once, in `packages/ui/src/styles/palette.css`; the accent is olive-700 (light) / olive-300 (dark). The comment fields have a distinct fill and border (from 1.20:1 to 6.46:1 light, 8.43:1 dark) and a visible focus ring. Staging deploy run 42623742591: axe found 0 serious or critical issues on 31 page-and-mode checks. Screenshots: `.orchestrate/runs/2026-11-09-09-olive-palette/evidence/screenshots/`. Box 3 waits on James's approval of the look.

**2026-11-09 Claude (orchestrator):** Done. James approved the look on staging ("comment boxes look a lot better"). He noted there's no theme switcher: `Base.astro` reads a `theme` cookie, but nothing sets it. Split into ticket 21.
