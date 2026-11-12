# 26-f1ded3ae: Restore Usermaven tracking through a first-party proxy

**Spec:** none.

**What to build:**

Found 2026-11-12: Usermaven analytics stopped when jamesryan.dev moved to this stack (James: "It was installed previously"). The old site (`~/Repos/astro-blog`, `src/components/UserMavenAnalytics.astro` in its layout) loaded `https://um.jamesryan.dev/lib.js` with `data-tracking-host` `https://um.jamesryan.dev`, autocapture, `data-privacy-policy="strict"` and `data-randomize-url="true"`. `um.jamesryan.dev` is still a CNAME to `whitelabel.usermaven.com` and serves `lib.js`. This repo has no snippet at all.

James asked whether to use Usermaven's Cloudflare Workers proxy (https://usermaven.com/docs/articles/cloudflare-workers-proxy-1efbfffa): `/lib.js` goes to `t.usermaven.com` and everything else to `events.usermaven.com`, served from your own domain so ad blockers interfere less. Decision (orchestrator): yes, as the guide's **subdirectory** method, built into the marketing site's own Worker rather than a separate hand-deployed Worker, so it's versioned, tested and deployed by the pipeline like everything else.

1. **The proxy route:** an Astro endpoint (server-rendered, not middleware on every request) at a short, neutral path on the site (the guide suggests random-looking names; pick one and keep it in one constant). `/lib.js` maps to `https://t.usermaven.com/lib.js`; other paths map to `https://events.usermaven.com`, with the prefix stripped.
   - **Forward an allowlist of request headers, never all of them.** In particular, never forward `Cookie` or `Authorization`: this domain carries EmDash admin session cookies. (`~/Repos/gml/src/middleware.ts` forwards every header; don't copy that.)
   - Pass the visitor's IP from `CF-Connecting-IP` as `X-Forwarded-For` (and user agent), so Usermaven's geo and device data stay right. Check Usermaven's docs for the header it expects, and cite it.
   - Don't add `Access-Control-Allow-Origin: *`; the script is same-origin now. Responses aren't cached by the site's route cache.
2. **The snippet:** one component in the marketing site's base layout, the old site's attributes, with `data-tracking-host` and `src` pointing at the proxy path. The workspace key is per-deployment config (a Wrangler `vars` entry, public by design): production sets it; **staging leaves it unset, and then no snippet renders and the proxy route returns 404**, so staging never pollutes the production workspace. Keep the garden out of scope.
3. **No telemetry for our tools, analytics is James's choice for his site:** keep `data-privacy-policy="strict"` (cookieless), as before. Check whether the privacy policy or a consent banner needs anything, and list it for James; don't write copy.
4. **MCP for checking:** already done at user scope (`~/.mcporter/mcporter.json`, server `usermaven`, set up by the agent-workflow session 2026-11-12); this ticket adds no repo config for it.
5. Tests: the endpoint's header allowlist (cookie and authorization stripped, IP forwarded), the path mapping, and 404 when unconfigured; the rendered check asserts the snippet is absent without a key and present with one.

**Blocked by:** none.

**Status:** in progress

- [ ] The proxy forwards `lib.js` and event requests with only allowlisted headers and the visitor's IP; without a key the snippet is absent and the route 404s (tests, and the rendered check in CI).
- [ ] After promotion, production loads `lib.js` from the proxy path, an event request returns 2xx, and the event appears in Usermaven (orchestrator, through the Usermaven MCP or the dashboard; output in a comment).

## Comments

**2026-11-12 Claude (orchestrator):** Raised from James's report that tracking broke. Risk: high (a proxy on the production domain handling visitors' requests, headers and IPs, next to admin session cookies). Builder Google (agy Carbon); the orchestrator's review is cross-family.

**2026-11-12 Claude (orchestrator):** PR #30 merged to master as 13d7333; it's on staging, keyless. James's decision: switch off the browser event queue (`data-disable-event-persistence="true"`), so the tracking stores nothing on visitors' devices. The follow-up is on branch `26b-usermaven-no-persistence`. Box 2 waits for the next promotion.
