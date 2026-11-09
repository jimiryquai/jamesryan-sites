# 21-6dce9bb8: Add a light, dark and system theme switcher

**Spec:** docs/specs/baseline.md

**What to build:**

Found on ticket 09 (2026-11-09; James: "I don't have a theme switcher though"). The plumbing is half there. `packages/ui/src/components/Base.astro`'s inline head script reads a `theme` cookie (`dark` or `light`) and otherwise follows `prefers-color-scheme`, and ticket 09's `@custom-variant dark` lets an explicit `.light`/`.dark` class win over the system preference (EmDash's dark-mode convention: https://docs.emdashcms.com/guides/dark-mode/, read it through mcporter). But nothing on the site sets the cookie, so visitors only ever get their system setting.

1. A switcher in the shared header (in `packages/ui`, so both apps get it), offering light, dark and system. Choosing one sets or clears the `theme` cookie and updates the root class at once, with no reload and no flash. System clears the cookie and follows `prefers-color-scheme` again, including live changes.
2. It's a real control: a button or radio group with an accessible name and the current state announced (for example `aria-pressed`, or a menu with `aria-checked`), operable by keyboard, with the focus ring from ticket 09. Use icons from the existing icon set, and label it with "Theme". Any other visible wording goes in the report as a proposal; the copy is James's.
3. The cookie is first-party: `Path=/`, `SameSite=Lax`, a year's `Max-Age`, no tracking. Check the server-side render and cache still serve one page to everyone: the class is applied on the client, so caching mustn't vary by cookie.
4. Tests: the head script and the switcher's state logic, red-first. The staging axe check (`scripts/check-accessibility.mjs`) covers the header with the switcher in light and dark.

Marketing site first; the garden inherits the shared header, but isn't checked (out of scope).

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] A visitor can choose light, dark or system from the header; the choice persists across pages and visits, with no flash on load (screenshots and a recorded run).
- [ ] The switcher is keyboard-operable and announces its state; axe on staging reports no serious or critical issues with it.

## Comments

**2026-11-09 Claude (orchestrator):** Raised from James's note on ticket 09. Risk: medium (a shared component, a cookie, a head script).
