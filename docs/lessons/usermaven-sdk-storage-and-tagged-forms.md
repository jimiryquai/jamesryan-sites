---
type: Lesson
title: Usermaven's browser SDK keeps a localStorage retry buffer and requires tagged form tracking
description: lib.js unconditionally writes usermaven_offline_queue_default_data to localStorage even in strict cookieless mode, and data-form-tracking="all" captures raw input values across every <form>, so keep data-form-tracking="tagged" and opt in marketing forms with data-um-form.
tags: [usermaven, analytics, privacy]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T18:05:00Z }
sources:
  - id: ticket
    resource: .scratch/baseline/issues/26-f1ded3ae-restore-usermaven-tracking-through-a-first-party-proxy.md
  - id: component
    resource: apps/marketing-site/src/components/UsermavenAnalytics.astro
  - id: check
    resource: scripts/seo-fixture.mjs (verifyUsermaven asserts setAttribute("data-form-tracking", "tagged"))
---

# Context
During ticket 26, inspecting minified `lib.js` surfaced a `disableEventPersistence` config flag, leading to a follow-up attempt (`26b`) to eliminate client-side storage via `data-disable-event-persistence="true"`. Reading `@usermaven/sdk-js` source and running Playwright against real `lib.js` proved two non-obvious SDK behaviours: (1) `initFromScript()` never reads `data-disable-event-persistence`, and `RetryQueue` unconditionally instantiates `LocalStoragePersistence("offline_queue_default")`; (2) `data-form-tracking="all"` attaches to every `<form>` and sends raw `.value` strings for every `<input>`, `<select>`, and `<textarea>` (except `password` or `.um-no-capture`), which on blog posts includes EmDash's `<CommentForm />` (commenter name, email, and comment body) as well as `/search`.[^ticket]

# Lesson
Keep `data-form-tracking="tagged"` on `UsermavenAnalytics.astro` so Usermaven tracks only forms explicitly marked with `data-um-form`, and treat the ephemeral `usermaven_offline_queue_default_data` retry buffer (`{"queue":"[]"}` once sent, zero cookies, zero persistent visitor ID under `data-privacy-policy="strict"`) as built into unmodified `lib.js`.[^component][^check] Also trace both the bootstrap attribute parser and every caller in upstream SDK source before proposing third-party `data-*` flags.

# How to apply
- When adding a lead-capture or newsletter `<form>` that should report `$form` submissions to Usermaven, add `data-um-form` to that `<form>` element (and add class `um-no-capture` to any field whose value must not be sent).
- Never add `data-um-form` to EmDash's `<CommentForm />` or `/search`, and never switch `UsermavenAnalytics.astro` back to `data-form-tracking="all"`; `scripts/seo-fixture.mjs` fails CI if `setAttribute("data-form-tracking", "tagged")` is missing.[^check]
- When drafting or updating `/privacy-policy`, note that analytics sets no cookies or persistent identifiers and holds only an ephemeral in-flight event buffer in `localStorage`.

[^ticket]: Ticket 26 (`26-f1ded3ae`) rounds `26b` and `26c`
[^component]: `apps/marketing-site/src/components/UsermavenAnalytics.astro`
[^check]: Rendered SEO & Usermaven check in `scripts/seo-fixture.mjs`
