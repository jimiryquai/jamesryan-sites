# 07-2cb06315: Give each site its own staging and production resources

**Spec:** docs/specs/baseline.md

**What to build:**

jamesryan.dev: create a dedicated staging KV namespace (staging currently shares production's `SESSION`). Garden: rename the worker to `jamesryan-me`, set `site` to `https://jamesryan.me`, and create `jamesryan-me-staging` D1, R2 and KV plus production equivalents, all with `database_id`s in `wrangler.jsonc`; an `env.staging` route to `staging.jamesryan.me`; **no production route** yet. Strip hard-coded hostnames from the apps' `image.domains` and similar config in favour of values derived from `site`. If the agent's token can't create resources, generate a wizard (the `wizard` skill) for James.

**Blocked by:** 01-39b13245.

**Status:** done

- [x] `wrangler.jsonc` for both apps lists distinct staging and production bindings (no shared IDs).
- [x] Garden has no production route; jamesryan.me is unchanged.
- [x] Resources exist in Cloudflare (`wrangler d1 list`, `r2 bucket list`, `kv namespace list` output in a comment).

## Comments

**2026-11-08 Claude (orchestrator):** Risk: high (no docs/agents/review.md; creates Cloudflare resources and changes both workers' bindings and routes).

# 07-2cb06315 implementation comment

Implemented in `e647f00` on `07-cloudflare-resources`. Dedicated marketing staging SESSION and garden staging/production D1, R2 and SESSION were created. Existing production bindings preserved. Garden has only a staging custom domain configured. No deploy or DNS changes.

## Cloudflare inventory evidence

### D1: `wrangler d1 list`
Raw: `.orchestrate/evidence/d1-after.log`

```text
│ 7719473e-1e63-423d-a350-fbe8221a5491 │ jamesryan-me             │ 2026-11-08T14:43:14.679Z │ production │ 0          │ 8192      │              │
│ 449e7ed9-de4d-4518-ad02-1ad8501ab2dc │ jamesryan-me-staging     │ 2026-11-08T14:43:13.404Z │ production │ 0          │ 8192      │              │
│ c623fded-80e8-412d-a12c-5b634f856195 │ jamesryan-emdash-staging │ 2026-05-04T11:42:54.647Z │ production │ 0          │ 1990656   │              │
│ 3c250296-434a-49e4-9fd4-98e72e855a82 │ jamesryan-emdash         │ 2026-05-04T11:40:01.181Z │ production │ 0          │ 733184    │              │
```

### R2: `wrangler r2 bucket list`
Raw: `.orchestrate/evidence/r2-after.log`

```text
name:           jamesryan-me
name:           jamesryan-me-staging
name:           jamesryan-media
name:           jamesryan-media-staging
```

### KV: `wrangler kv namespace list`
Raw: `.orchestrate/evidence/kv-after.log`

```text
[
  {
    "id": "05057aa8a9cf4a2d9d54d65a03c32b3e",
    "title": "astro-blog-session",
    "supports_url_encoding": true
  },
  {
    "id": "89d4a7fc3c4944d1a794c570516c0f60",
    "title": "astro-blog-staging-session",
    "supports_url_encoding": true
  },
  {
    "id": "663132bd5df045fb9efed73f1544c120",
    "title": "gml-session",
    "supports_url_encoding": true
  },
  {
    "id": "3fcef3fa51fb45c6804133c49e498f51",
    "title": "jamesryan-me",
    "supports_url_encoding": true
  },
  {
    "id": "593150d3108e40e1aa09cdbc6965c679",
    "title": "jamesryan-me-staging",
    "supports_url_encoding": true
  },
  {
    "id": "91dc7ef3718746df9bd9fd8d4c44d1e0",
    "title": "jamesryan-session-staging",
    "supports_url_encoding": true
  },
  {
    "id": "78ffb81ed8a648459bdcf9a78e01e718",
    "title": "my-marketing-site-session",
    "supports_url_encoding": true
  }
]
```

## Checks

`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test` passed. Raw output under `.orchestrate/evidence/`. Two config tests plus 56 plugin tests passed.

Both before and after `curl -sI https://jamesryan.me` returned `HTTP/2 522`; raw headers in `domain-before.log` and `domain-after.log`. This is the existing origin error; production was not deployed or changed.

Docs: [EmDash Cloudflare bindings](https://docs.emdashcms.com/deployment/cloudflare/), [Wrangler environments and non-inheritable bindings](https://developers.cloudflare.com/workers/wrangler/configuration/), [Astro site and image configuration](https://docs.astro.build/en/reference/configuration-reference/). Retain DB/MEDIA/LOADER adapter binding names, repeat storage bindings per environment, and derive image hosts from the canonical site URL.

PR https://github.com/jimiryquai/jamesryan-sites/pull/10 is open against `baseline`. All checks passed:

```text
Socket Security: Project Report	pass	2s	https://socket.dev/dashboard/org/james-ryan/sbom/92a4fab4-29b7-42c5-8ef1-3ae2385867f1	
Socket Security: Pull Request Alerts	pass	19s	https://socket.dev	
Typecheck, build and test	pass	2m4s	https://github.com/jimiryquai/jamesryan-sites/actions/runs/42491470266/job/128764575673
```
Raw check output: `.orchestrate/evidence/pr-checks.log`; raw CI log: `.orchestrate/evidence/ci.log`.

Fix round 1: pushed `124947e` restoring garden Worker Loader explanation above production and staging bindings, both apps' compact compatibility flags, and original garden JSONC trailing commas. Semantic bindings/routes unchanged; `pnpm test`, `pnpm typecheck`, `pnpm build` pass. Evidence in `.orchestrate/evidence/fix-round-1-*.log`. Updated PR needs the orchestrator to resolve package.json against ticket 16 on baseline before fresh CI can run; only Socket Project Report has run on this head.

**2026-11-08 Claude (orchestrator):** Done. Built by h07-codex (Codex, GPT-6.1 Sol), PR #10 (e647f00, 124947e) merged into `baseline`. Orchestrator confirmed every new resource in Cloudflare by ID (`wrangler d1 list`, `r2 bucket list`, `kv namespace list`). Fix round 1 restored the dropped `worker_loaders` comment and the JSONC style. Merge kept both 07's `scripts/*.test.mjs` test step and 16's mcporter devDependency; merged-tree checks pass (`ℹ tests 2`, `ℹ pass 2`). For James: (1) production SESSION for jamesryan.dev is the KV titled `astro-blog-staging-session` (a leftover name from the old astro-blog worker; staging now has `jamesryan-session-staging`); (2) https://jamesryan.me answers HTTP 522 before and after this ticket, so something already points that domain at an unreachable origin. Evidence: `.orchestrate/runs/2026-11-08-07-cloudflare-resources/`.
