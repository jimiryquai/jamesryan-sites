---
type: Lesson
title: Workers AI fast-v2 models return parsed JSON objects instead of strings
description: Cloudflare Workers AI routes @cf/meta/llama-3.1-8b-instruct to fast-v2, returning result.response as a parsed JS object when the model outputs JSON, which crashes string-only parsers and swallows unawaited Worker Loader RPC logs.
tags: [cloudflare, workers-ai, emdash, plugins]
generated: { by: agy/gemini-4-carbon, at: 2026-11-13T09:53:00Z }
sources:
  - id: ticket
    resource: .scratch/baseline/issues/11-3b1d7a85-install-the-comment-moderator-sandboxed-on-jamesryan-dev.md
  - id: config
    resource: apps/marketing-site/astro.config.mjs
---

# Context
During Ticket 11's live staging verification of `emdash-plugin-ai-comment-moderation@2.1.0` (running sandboxed via `@emdash-cms/cloudflare` Worker Loader), clean, spam, and toxic comments all fell back to `status: "pending"` even though `PluginBridge` RPC tail traces showed `settingsGet` and `httpFetch` succeeding with `outcome: "ok"`.[^ticket] Calling the Workers AI REST endpoint directly revealed two interacting behaviours: `@cf/meta/llama-3-8b-instruct` is retired (`HTTP 410`), and `@cf/meta/llama-3.1-8b-instruct` now routes to `@cf/meta/llama-3.1-8b-fast-v2`, which auto-parses JSON completions so `data.result.response` is a JavaScript object (`{ spam, toxic }`) rather than a string. `parseModerationResponse(raw)` called `JSON.parse(raw)` and then `raw.match(...)` inside `catch`, throwing `TypeError: raw.match is not a function`. Because `ctx.log.error(...)` was called without `await` right before `invokeHook` returned, the ephemeral Worker Loader isolate terminated before the `PluginBridge` log RPC flushed, leaving zero error logs in Worker traces.[^ticket]

# Lesson
Treat Cloudflare Workers AI `result.response` as `string | Record<string, unknown>` (or select a model variant such as `@cf/meta/llama-3.1-8b-instruct-fp8` whose REST envelope keeps `result.response` as a string), and always `await` `ctx.log.*` calls inside Worker Loader sandboxed plugins before returning from hooks.[^ticket]

# How to apply
- For `emdash-plugin-ai-comment-moderation@2.1.0`, configure `plugin:ai-comment-moderation:settings:model` to `@cf/meta/llama-3.1-8b-instruct-fp8` (and ensure `emdash:exclusive_hook:comment:moderate` is set to `"ai-comment-moderation"` in D1 `options`).
- When authoring Workers AI callers, accept both `typeof response === "object" && response !== null` and JSON strings before running regex fallbacks.
- Always `await ctx.log.info(...)` / `await ctx.log.error(...)` in sandboxed EmDash plugin hooks so `PluginBridge` RPC calls complete before isolate teardown.

[^ticket]: Ticket 11 (`11-3b1d7a85`, live staging verification on `staging.jamesryan.dev`)
[^config]: `apps/marketing-site/astro.config.mjs`
