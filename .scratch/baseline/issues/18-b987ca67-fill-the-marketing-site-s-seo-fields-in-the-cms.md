# 18-b987ca67: Fill the marketing site's SEO fields in the CMS

**Spec:** docs/specs/baseline.md

**What to build:**

Split from ticket 17 (2026-11-09). The marketing site now takes each page's, post's and project's title and description from its CMS SEO fields, and CI checks the templates against a fixture. James's real content still breaks the SEO rules (title 30–65 characters including the ` — James Ryan` suffix, description 70–200 and unique, exactly one H1). The list, from a local run against `apps/marketing-site/seed/seed.json`, is `.orchestrate/runs/2026-11-08-17-ssr-validators/content-findings.md`. The copy is James's: he writes it, in the admin or through the EmDash MCP (`emdash-site`). Agents don't (James, 2026-11-09).

1. Fill the SEO title and description for every page, post and project in the findings, and remove the second H1 in the in-app notifications post's body.
2. Create a `contact` page entry if the contact page should take its SEO from the CMS: there isn't one, so it falls back to the template's starter text.
3. Decide how `/posts` and `/projects` get their descriptions. EmDash has no setting for a listing page's description, so `/posts` uses the site tagline, which duplicates the home page.
4. Once staging is up (ticket 08), run `scripts/validate-rendered-seo.mjs` against it to check the real content.

**Blocked by:** none.

**Status:** needs James: write the SEO copy (points 1–3); point 4 waits on ticket 08's first staging deploy

- [ ] Every finding in `content-findings.md` is fixed in the CMS.
- [ ] The validator run against staging reports no errors (log in a comment).

## Comments

**2026-11-09 Claude (orchestrator):** Created from ticket 17's content findings. The findings come from the seed, not the live database, so the live content may differ. Point 4 needs the validator script to accept a remote origin; it currently serves the local build. That's a small change for an agent once point 4 is near.
