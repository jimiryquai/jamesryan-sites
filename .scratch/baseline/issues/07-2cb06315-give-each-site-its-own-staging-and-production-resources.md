# 07-2cb06315: Give each site its own staging and production resources

**Spec:** docs/specs/baseline.md

**What to build:**

jamesryan.dev: create a dedicated staging KV namespace (staging currently shares production's `SESSION`). Garden: rename the worker to `jamesryan-me`, set `site` to `https://jamesryan.me`, and create `jamesryan-me-staging` D1, R2 and KV plus production equivalents, all with `database_id`s in `wrangler.jsonc`; an `env.staging` route to `staging.jamesryan.me`; **no production route** yet. Strip hard-coded hostnames from the apps' `image.domains` and similar config in favour of values derived from `site`. If the agent's token can't create resources, generate a wizard (the `wizard` skill) for James.

**Blocked by:** 01-39b13245.

**Status:** in progress

- [ ] `wrangler.jsonc` for both apps lists distinct staging and production bindings (no shared IDs).
- [ ] Garden has no production route; jamesryan.me is unchanged.
- [ ] Resources exist in Cloudflare (`wrangler d1 list`, `r2 bucket list`, `kv namespace list` output in a comment).

## Comments

**2026-11-08 Claude (orchestrator):** Risk: high (no docs/agents/review.md; creates Cloudflare resources and changes both workers' bindings and routes).
