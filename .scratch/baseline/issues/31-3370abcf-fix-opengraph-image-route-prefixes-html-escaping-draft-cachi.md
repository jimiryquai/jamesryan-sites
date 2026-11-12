# 31-3370abcf: Fix OpenGraph image route prefixes, HTML escaping, draft caching and font loading

**Spec:** docs/specs/baseline.md

**What to build:**

The OpenGraph image routes are duplicated across both apps (`apps/marketing-site/src/pages/og/{[...slug].png.ts,default.png.ts}` and `apps/digital-garden/src/pages/og/{[...slug].png.ts,default.png.ts}`) and have five correctness, security, and caching defects:

1. **Prefix mismatch (`404`/wrong collection lookup):** `packages/ui/src/components/Base.astro:111-119` emits `/og/posts/${content.id}.png` and `/og/projects/${content.id}.png`, whereas `apps/marketing-site/src/pages/og/[...slug].png.ts:20-26` (and `digital-garden:19-25`) checks `prefix === "blog"` and `prefix === "work"`. Every post and project OG URL therefore queries the `"pages"` collection, misses, and renders a generic card with the site title (`"Oatmeal"` fallback at line `45`).
2. **Unescaped HTML interpolation into `ImageResponse`:** `og/[...slug].png.ts:60-79` and `og/default.png.ts:17-33` interpolate `${siteTitle}`, `${title}`, `${subtitle}`, and `${url.host}` directly into an HTML template string without escaping `&`, `<`, `>`, or `"`, breaking Satori HTML parsing or allowing markup injection when titles contain `<` or `&` (e.g. `"C# & .NET"` or `"<script>"`).
3. **Draft exposure & immutable cache poisoning:** `og/[...slug].png.ts:33,99` fetches `getEmDashEntry` without checking `entry.data.status === "published"` (or preview context), returns `200` even for non-existent slugs, omits `Astro.cache.set(cacheHint)`, and sets `"Cache-Control": "public, max-age=31536000, immutable"`, permanently caching stale or draft titles on CDNs.
4. **Live Google Fonts network call per miss:** `og/[...slug].png.ts:54-57` and `og/default.png.ts:12-15` call `loadGoogleFont({ family: "Inter" })` over outbound HTTP at request time instead of reading bundled font bytes, adding external runtime latency/failure coupling.
5. **Duplication & retired palette in `digital-garden`:** `apps/digital-garden/src/pages/og/[...slug].png.ts:44,60` and `og/default.png.ts:9,18` still hardcode `"Oatmeal Digital Garden"` and `linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #f472b6 100%)`. Extract one shared OG image module used by thin route wrappers in both apps.

**Blocked by:** none.

**Status:** in progress

- [ ] `/og/posts/<slug>.png`, `/og/projects/<slug>.png`, and `/og/pages/<slug>.png` resolve the matching published collection entry and render its title/excerpt; missing or draft entries return HTTP `404` without `immutable` public caching.
- [ ] Titles and subtitles containing `&`, `<`, `>`, and quotes render accurately without Satori parse failures or HTML injection.
- [ ] OG image generation uses `Astro.cache.set(cacheHint)` with bounded revalidateable `Cache-Control` headers, avoids outbound Google Fonts fetches on request paths, and shares one implementation across both apps using the olive palette.

## Comments

**2026-11-12 Gemini (agy Carbon, orchestrator):** Promoted to `baseline` and claiming for `h31-pi` (`zai/glm-5.3`, branch `31-og-image-routes`). Risk: medium (reversible PR to `master`).
