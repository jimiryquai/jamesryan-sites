# 09-b9733862: Consolidate to one olive palette meeting WCAG 2.2 AA

**Spec:** docs/specs/baseline.md

**What to build:**

Make the olive scale in `tailwind.css` the one palette: one token file, used everywhere. Delete the indigo and pink tokens in `src/styles/theme.css` and `globals.css` and every use of them; pick an accent from the olive design or ask James. Check every text/background pair in light and dark modes against WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI). Fix failures by changing lightness, not hue. Add axe (`@axe-core/playwright` or `pa11y-ci`) plus a contrast check to the staging smoke job, failing on serious or critical issues. Apply the same to the garden. Produce before/after screenshots of the home page, a post and the admin-facing pages for James.

**Blocked by:** 05-10cd2eae, 08-2655a1e3.

**Status:** in progress

- [ ] One palette definition per app (or one shared in `packages/ui`), with no `#6366f1`/`#f472b6` left (`grep` proves it).
- [ ] axe reports zero serious/critical issues on the staging pages, light and dark, in CI.
- [ ] Before/after screenshots attached; status `needs James` until he approves the look.

## Comments

**2026-11-09 Claude (orchestrator):** Claimed. Risk: high (CI definition: axe in the staging smoke job). Scope: the marketing site only, since James has put the garden out of scope for now; the accent comes from the olive design and James approves the look from screenshots. h09-codex (Codex, GPT-6.1 Sol), branch `09-olive-palette`, base `master`.
