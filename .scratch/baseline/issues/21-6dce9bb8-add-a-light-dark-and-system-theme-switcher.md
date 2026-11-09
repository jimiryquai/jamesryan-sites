# 21-6dce9bb8: Add a light, dark and system theme switcher

**Spec:** docs/specs/baseline.md

**What to build:**

Found on ticket 09 (2026-11-09; James: "I don't have a theme switcher though"). The plumbing is half there. `packages/ui/src/components/Base.astro`'s inline head script reads a `theme` cookie (`dark` or `light`) and otherwise follows `prefers-color-scheme`, and ticket 09's `@custom-variant dark` lets an explicit `.light`/`.dark` class win over the system preference (EmDash's dark-mode convention: https://docs.emdashcms.com/guides/dark-mode/, read it through mcporter). But nothing on the site sets the cookie, so visitors only ever get their system setting.

1. A switcher in the shared header (in `packages/ui`, so both apps get it), offering light, dark and system. Choosing one sets or clears the `theme` cookie and updates the root class at once, with no reload and no flash. System clears the cookie and follows `prefers-color-scheme` again, including live changes.
2. **The design (James, 2026-11-09: option B):** one icon button in the header showing the current theme (sun, moon, or half-circle for system), which opens a small menu: **Light**, **Dark**, **System**, each with its icon, the current one marked. A menu button pattern: an accessible name ("Theme"), `aria-expanded`, `aria-checked` (or equivalent) on the current item, arrow-key navigation, Escape closes and returns focus, click outside closes, and the focus ring from ticket 09. Icons come from the existing icon set. The wording is the four words above, nothing more.
3. The cookie is first-party: `Path=/`, `SameSite=Lax`, a year's `Max-Age`, no tracking. Check the server-side render and cache still serve one page to everyone: the class is applied on the client, so caching mustn't vary by cookie.
4. Tests: the head script and the switcher's state logic, red-first. The staging axe check (`scripts/check-accessibility.mjs`) covers the header with the switcher in light and dark.

Marketing site first; the garden inherits the shared header, but isn't checked (out of scope).

**Blocked by:** none.

**Status:** done

- [x] A visitor can choose light, dark or system from the header; the choice persists across pages and visits, with no flash on load (screenshots and a recorded run).
- [x] The switcher is keyboard-operable and announces its state; axe on staging reports no serious or critical issues with it.

## Comments

**2026-11-09 Claude (orchestrator):** Raised from James's note on ticket 09. Risk: medium (a shared component, a cookie, a head script).

**2026-11-09 Claude (orchestrator):** Short grilling with James: he chose a single icon button opening a Light, Dark, System menu (option B) over three always-visible buttons or a two-way toggle. The labels are as shown in the mockup.

**2026-11-09 Claude (orchestrator):** Done. h21-codex (Codex, GPT-6.1 Sol), PR #19 (803d60a, a571e75), merged as 9d2d239, no fix round. Option B: a Theme icon button opening a Light, Dark, System menu (menu-button pattern, arrow, Home, End, Escape and outside-click handling) in the shared header. One inline head controller owns the first-party `theme` cookie; System clears it and follows live media changes; the server render doesn't vary by cookie. The orchestrator re-ran install, typecheck, build, test (28 pass) and the rendered SEO check. Local recorded run: `theme-run.webm`, persistence across navigation and reload with no flash. Red proof: an unlabelled switcher fails axe with 4 issues. Staging deploy 42628600000 range (run for 9d2d239): axe found 0 serious or critical issues on 33 checks, menu open and closed, light and dark; `aria-label="Theme"` is live on staging. Evidence: `.orchestrate/runs/2026-11-09-21-theme-switcher/`.
