---
type: Lesson
title: Workspace Astro UI packages need their own astro check and canonical platform unions
description: App-level astro check skips workspace dependency packages resolved via node_modules, allowing type mismatches against EmDash unions like PagePlacement ("body:start" vs "body-start") to pass CI silently.
tags: [astro, emdash, typescript, monorepo]
generated: { by: agy/gemini-4-carbon, at: 2026-11-12T21:18:00Z }
sources:
  - id: pr-43
    resource: https://github.com/jimiryquai/jamesryan-sites/pull/43
  - id: page-fragments
    resource: packages/ui/src/utils/page-fragments.ts
---

# Context
While hardening plugin fragment rendering in `packages/ui/src/utils/page-fragments.ts` for Ticket `29-79f19342`, the initial implementation grouped body fragments under `"body-start"` and `"body-end"` (matching hyphenated prose in the ticket) rather than EmDash 1.5's exported `PagePlacement` union (`"head" | "body:start" | "body:end"`), and untyped `.mjs` unit tests reinforced the hyphenated keys.[^pr-43] Root `pnpm typecheck` still passed because `astro check` inside `apps/marketing-site` and `apps/digital-garden` only checks files inside each app directory and skips workspace packages linked through `node_modules/@jamesryan/*`, while `packages/ui/package.json` had no `typecheck` script.[^page-fragments]

# Lesson
Every shared workspace package (`packages/*`) must declare its own `typecheck` script (`astro check` for packages containing `.astro` components, `tsc --noEmit` for pure `.ts` packages) and import exported union types directly from platform packages (`emdash`, `emdash/page`) instead of restating string-literal unions by hand.[^pr-43]

# How to apply
- Add `"typecheck"` scripts to every `packages/*/package.json` so `pnpm -r --if-present typecheck` checks shared `.astro` and `.ts` files directly.
- Import `type PagePlacement` from `"emdash"` and `resolveFragments` from `"emdash/page"` rather than spelling placement unions manually or testing only hand-crafted `.mjs` string fixtures.

[^pr-43]: PR #43 (`9721d2d`, Ticket `29-79f19342` cross-family review)
[^page-fragments]: `packages/ui/src/utils/page-fragments.ts` and `packages/ui/package.json`
