# 29-79f19342: Harden HTML fragment escaping, CMS link protocols and untrusted form/HTML surfaces

**Spec:** docs/specs/baseline.md

**What to build:**

Close four untrusted-output and PII-logging surfaces across shared layout and app routes:

1. `packages/ui/src/components/Base.astro:32-49,351-354,374`: `renderFragment` interpolates `f.attributes` (`${k}="${v}"` at lines `36-38,41-43`), `f.src` (`src="${f.src}"` at line `46`), and inline `f.code` (`<script ${attrs}>${f.code}</script>` at line `39`) without escaping quotes, HTML entities, or `</script>` sequences, and lines `351-354` silently drop `"body-start"` and `"body-end"` fragment placements. Escape attribute names/values and closing `</script>` sequences, and render `"body-start"` / `"body-end"` placements in `<body>`.
2. `apps/marketing-site/src/pages/projects/[slug].astro:101` and `apps/digital-garden/src/pages/projects/[slug].astro:101`: `<a href={project.data.url}>` renders an unvalidated string field from the CMS without restricting schemes to `http:` or `https:`, allowing `javascript:` URLs. Validate external CMS URLs through a shared helper (`http:`/`https:` only) before rendering link `href`s.
3. `apps/marketing-site/src/components/blocks/Document.astro:22` and `apps/digital-garden/src/components/blocks/Document.astro:22`: `<div set:html={content} />` injects raw unsanitized HTML (`marketing-site` no longer uses `Document.astro`; `digital-garden` still wires it via `MarketingBlocks.astro:14,40`). Delete the dead `marketing-site` component and sanitize or retire the raw HTML sink in `digital-garden`.
4. `apps/digital-garden/src/pages/contact.astro:20-50,83-109`: template `POST` handler has no CSRF or rate-limit protection, logs visitor PII (`name`, `email`, `company`, `message`) via `console.log` at lines `36-41` to Worker logs, discards the submission, and displays `"Thanks for reaching out! We'll get back to you within 24 hours."` alongside placeholder `hello@acme.example` (`line 89`). Remove the fake `POST` PII-logging handler and placeholder contact details.

**Blocked by:** none.

**Status:** in progress

- [ ] Unit tests cover `renderFragment` attribute escaping (`"`, `&`, `<`, `>`), `</script>` neutralization, and `"head"`, `"body-start"`, and `"body-end"` placements in `packages/ui/src/components/Base.astro`.
- [ ] CMS `project.data.url` values with non-`http(s):` schemes (such as `javascript:alert(1)` or `data:`) are rejected and not rendered as clickable `<a>` links in either app.
- [ ] Unsanitized `<div set:html={content} />` in `Document.astro` and the PII-logging `POST` handler in `apps/digital-garden/src/pages/contact.astro` are removed or sanitized with test coverage.

## Comments

**2026-11-12 Gemini (agy Carbon, orchestrator):** Claiming for `h29-codex` (`GPT-6.1-Sol`, branch `29-harden-fragments-links-contact`). Risk: medium (reversible layout, component, and staging-only `digital-garden` route hardening targeting `master`; Note: `apps/marketing-site/src/components/blocks/Document.astro` was already deleted in PR #42 / `35-46c37e20`).
