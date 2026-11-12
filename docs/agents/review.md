# Review policy

This file holds policy; the `orchestrate` skill owns the process and [merging.md](merging.md) owns enforcement.

## Risk tiers

Blast radius decides; the highest matching tier wins and uncertainty raises it. CI definition and branch-policy changes are always high.

| Tier | Criteria in this repo | Review required |
|---|---|---|
| Low | Reference docs, tracker edits on `baseline`, explainers, tests that only add coverage | Required CI and orchestrator review; orchestrator merges |
| Medium | Reversible application, package, component, script, seed or agent-instruction changes (`apps/`, `packages/`, `scripts/`, `AGENTS.md`, `docs/agents/`, specs) whose merge to `master` reaches only staging (`staging.jamesryan.dev`) | Required CI, `code-review` (Standards and Spec), cross-family review, and orchestrator review; orchestrator merges |
| High | Changes that cannot be undone by reverting the PR, auth/session/token/proxy/secret or visitor-PII handling, destructive data/schema scripts, CI definitions (`.github/workflows/`), branch policies, Cloudflare resource bindings, or any production write/promotion (`jamesryan.dev`) | Everything for Medium (including saved review evidence from a model family different from the builder's), plus James's approval before merge or live execution |

## Approvers

- Medium: the orchestrator (once required CI, `code-review`, and cross-family review findings are settled; standing staging-autonomous policy agreed by James, 2026-11-12).
- High: `jimiryquai` (James Ryan, `james@jamesryan.dev`), after saved cross-family review evidence covers the current diff.

## Where to look hardest

- **Published-route and preview boundaries:** unpublished CMS entries must 404 anonymously while authorized draft previews still render ([published-routes.md](../published-routes.md)).
- **Auth, session cookies, tokens and proxies:** `emdash_session` cookies, `Authorization` headers, Contributor vs Admin MCP tokens ([publishing.md](../publishing.md), [mcp.md](../mcp.md)), `--no-oauth` guards, and `/s1/*` proxy header/body filtering.
- **User-visible copy:** site titles, descriptions, and page/post prose belong to James; agents propose copy in reports rather than rewriting it silently.
- **Cloudflare & EmDash runtime rules:** server-rendered routes (`Astro.cache.set`), D1 migrations applied before Worker deploy, sandboxed plugin settings schemas and `EMDASH_ENCRYPTION_KEY`, WCAG 2.2 AA olive palette contrast in light and dark modes, and rendered SEO/media checks.
- **Recurring defects:** search `docs/lessons/` (when present) for touched areas; lessons own specific post-mortems rather than repeating them here.

## What to ignore

- `pnpm-lock.yaml` and generated declaration churn (`emdash-env.d.ts`, `worker-configuration.d.ts`, `.emdash/`) beyond the dependencies, schema, or bindings changed by the diff.
- Formatting a formatter would settle, and wording preferences in docs that do not change a rule or fact.

## How to report

Report each actionable finding with severity, file and line, the concrete failure and evidence, and the suggested correction. Separate Standards from Spec findings and state explicitly when either has none. Record the reviewed commit, builder and reviewer model families, and the evidence path for a high-tier cross-family review.
