# 26-f1ded3ae: Restore Usermaven tracking through a first-party proxy

**Spec:** none.

**What to build:**

Found 2026-11-12: Usermaven analytics stopped when jamesryan.dev moved to this stack (James: "It was installed previously"). The old site (`~/Repos/astro-blog`, `src/components/UserMavenAnalytics.astro` in its layout) loaded `https://um.jamesryan.dev/lib.js` with `data-tracking-host` `https://um.jamesryan.dev`, autocapture, `data-privacy-policy="strict"` and `data-randomize-url="true"`. `um.jamesryan.dev` is still a CNAME to `whitelabel.usermaven.com` and serves `lib.js`. This repo has no snippet at all.

James asked whether to use Usermaven's Cloudflare Workers proxy (https://usermaven.com/docs/articles/cloudflare-workers-proxy-1efbfffa): `/lib.js` goes to `t.usermaven.com` and everything else to `events.usermaven.com`, served from your own domain so ad blockers interfere less. Decision (orchestrator): yes, as the guide's **subdirectory** method, built into the marketing site's own Worker rather than a separate hand-deployed Worker, so it's versioned, tested and deployed by the pipeline like everything else.

1. **The proxy route:** an Astro endpoint (server-rendered, not middleware on every request) at a short, neutral path on the site (the guide suggests random-looking names; pick one and keep it in one constant). `/lib.js` maps to `https://t.usermaven.com/lib.js`; other paths map to `https://events.usermaven.com`, with the prefix stripped.
   - **Forward an allowlist of request headers, never all of them.** In particular, never forward `Cookie` or `Authorization`: this domain carries EmDash admin session cookies. (`~/Repos/gml/src/middleware.ts` forwards every header; don't copy that.)
   - Pass the visitor's IP from `CF-Connecting-IP` as `X-Forwarded-For` (and user agent), so Usermaven's geo and device data stay right. Check Usermaven's docs for the header it expects, and cite it.
   - Don't add `Access-Control-Allow-Origin: *`; the script is same-origin now. Responses aren't cached by the site's route cache.
2. **The snippet:** one component in the marketing site's base layout, the old site's attributes plus `data-form-tracking="tagged"` (James, 2026-11-12: opt-in `<form data-um-form>` only, so EmDash `<CommentForm />` and `/search` never send commenter emails/text or queries to Usermaven), with `data-tracking-host` and `src` pointing at the proxy path. The workspace key is per-deployment config (a Wrangler `vars` entry, public by design): production sets it; **staging leaves it unset, and then no snippet renders and the proxy route returns 404**, so staging never pollutes the production workspace. Keep the garden out of scope.
3. **No telemetry for our tools, analytics is James's choice for his site:** keep `data-privacy-policy="strict"` (cookieless), as before. Check whether the privacy policy or a consent banner needs anything, and list it for James; don't write copy.
4. **MCP for checking:** already done at user scope (`~/.mcporter/mcporter.json`, server `usermaven`, set up by the agent-workflow session 2026-11-12); this ticket adds no repo config for it.
5. Tests: the endpoint's header allowlist (cookie and authorization stripped, IP forwarded), the path mapping, and 404 when unconfigured; the rendered check asserts the snippet is absent without a key and present with one.

**Blocked by:** none.

**Status:** done

- [x] The proxy forwards `lib.js` and event requests with only allowlisted headers and the visitor's IP; without a key the snippet is absent and the route 404s (tests, and the rendered check in CI).
- [x] After promotion, production loads `lib.js` from the proxy path, an event request returns 2xx, and the event appears in Usermaven (orchestrator, through the Usermaven MCP or the dashboard; output in a comment).

## Comments

**2026-11-12 Claude (orchestrator):** Raised from James's report that tracking broke. Risk: high (a proxy on the production domain handling visitors' requests, headers and IPs, next to admin session cookies). Builder Google (agy Carbon); the orchestrator's review is cross-family.

**2026-11-12 Claude (orchestrator):** PR #30 merged to master as 13d7333; it's on staging, keyless. James's decision: switch off the browser event queue (`data-disable-event-persistence="true"`), so the tracking stores nothing on visitors' devices. The follow-up is on branch `26b-usermaven-no-persistence`. Box 2 waits for the next promotion.

**2026-11-12 Gemini (agy Carbon, orchestrator):** Handover from Claude. Carbon's investigation on `26b-usermaven-no-persistence` (archived at `.orchestrate/runs/2026-11-12-26-usermaven/`) proved `@usermaven/sdk-js` ignores `data-disable-event-persistence` in `initFromScript()` and unconditionally writes `usermaven_offline_queue_default_data` (`{"queue":"[]"}`) in `RetryQueue`. James's decisions (2026-11-12):
1. Keep unmodified `lib.js` as-is (drop `26b-usermaven-no-persistence`).
2. Add `data-form-tracking="tagged"` to `UsermavenAnalytics.astro` (rather than `"all"`, after orchestrator verified `form-tracking.ts` captures raw input values and blog posts render EmDash `<CommentForm />`).
Dispatching `h26c-codex` (Codex, OpenAI) on branch `26c-usermaven-form-tracking` from `origin/master` (`7edcc39`). Risk: high (visitor form-data boundary on production analytics snippet; cross-family review by Google orchestrator + James's merge approval).

**2026-11-12 Gemini (agy Carbon, orchestrator):** Codex 5h quota was 0%, so moved before briefing to `h26c-copilot` (`GPT-6.1 Terra`, OpenAI). Commit `97fbc07` (`fix: limit Usermaven form tracking to tagged forms`) opened as PR #35, passed independent local CI + Playwright tagged/untagged form verification (`Untagged form: 0 $form events`, `Tagged form: 1 $form event request(s)`) + Google cross-family review (`.orchestrate/evidence/26c-cross-family-review.md`) + GitHub CI, and was merged to `master` by `jimiryquai` as `b992c73`. Lesson recorded at `docs/lessons/usermaven-sdk-storage-and-tagged-forms.md`; explainer at `.scratch/explainers/26-f1ded3ae.html`; evidence archived at `.orchestrate/runs/2026-11-12-26c-usermaven-form-tracking/`. Box 1 complete; Box 2 awaits next production promotion.

**2026-11-13 Gemini (agy Carbon, orchestrator):** Box 2 verified live on `https://jamesryan.dev` after production promotion (`Deploy` run `43405785692`, staged commit `2cb5029`):
1. `https://jamesryan.dev/` renders the inline bootstrap configured with `key = "UMNstP14wS"`, `trackingHost = "https://jamesryan.dev/s1"`, `scriptSrc = "https://jamesryan.dev/s1/lib.js"`, `data-form-tracking="tagged"`, `data-privacy-policy="strict"`, and `data-randomize-url="true"`.
2. `GET https://jamesryan.dev/s1/lib.js` returned `HTTP/2 200` (`content-type: application/javascript`, `cache-control: private, max-age=3600`, no `Access-Control-Allow-Origin`).
3. Browser visit in Chromium sent `POST https://jamesryan.dev/s1/api.58626?p_016f1=UMNstP14wS&cookie_policy=strict&ip_policy=strict` → `200 {"status":"Ok"}`.
4. Confirmed ingestion via Usermaven MCP (`workspace_id: "3e4dc659-a41e-4a66-bf6c-cd1a3d188bca"`, `UMNstP14wS`, `2026-11-13`):
   - `usermaven.analytics_query_web_analytics` (`start_date: 2026-11-13`, `end_date: 2026-11-13`): `visitors: 0 → 1`, `new_visitors: 0 → 1`, `sessions: 0 → 1`, `pageviews: 0 → 1`.
   - `usermaven.analytics_query_page_performance` (`start_date: 2026-11-13`, `end_date: 2026-11-13`): `pages: [{"page_path": "/", "pageviews": 1, "visitors": 1, "visitor_share_percentage": 100, "bounce_rate_percentage": 100}]`.
5. Legacy `um.jamesryan.dev` CNAME (`whitelabel.usermaven.com`, record `61744d554a6d031f745b9ed0ddd923df`) is no longer referenced by `jamesryan.dev` and can be retired at James's convenience. Ticket done.
