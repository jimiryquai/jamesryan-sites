# Dependency overrides

The workspace lockfile is the source of resolved versions. With Astro 7.4.10,
Cloudflare adapter 14.4.7 and EmDash 1.5.0, no dependency overrides remain.
The 24-hour release-age policy still applies. The page builder's existing
0.2.0 exception now also permits James's 0.3.0 release; pnpm requires these
versions in one `||` entry because its first matching package rule wins.

## Removed in ticket 25

| Former override | Why it can be removed |
| --- | --- |
| `@astrojs/cloudflare>@cloudflare/vite-plugin` → `1.39.0` | Adapter 14 uses Vite 8 and requires plugin `^1.67.0`; retaining the old Vite 7 compatibility pin would put it outside the supported range. The lockfile resolves 1.68.0. Both apps build and the local Worker rendering checks exercise the new graph. |
| `zod@>=4 <4.6.6` → `4.6.7` | Astro and EmDash's updated packages accept patched Zod 4; all Zod 4 copies resolve to 4.6.7. Zod 3 remains a separate unresolved advisory below. |
| `sharp` → `0.35.5` | Updated image tooling accepts and resolves 0.35.5 without an override. Production continues to use Cloudflare Images. |
| `undici@7` → `7.30.2` | The updated Cloudflare tooling resolves patched Undici 7.30.1; font tooling independently uses Undici 8.12.4. |
| `ws` → `8.22.2` | Updated Cloudflare tooling accepts patched ws 8.21.0 or later. |
| `esbuild` → `0.28.2` | Updated tooling resolves 0.28.2 without forcing Astro 6's older range. |

## Remaining audit findings

`pnpm audit` on 2026-11-12 reports two findings and no Astro advisory:

| Package | Severity | Why it remains |
| --- | --- | --- |
| `zod` 3.25.76 | high, [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | `@jdevalk/emdash-plugin-seo@0.12.0` depends on its own older `@jdevalk/astro-seo-graph@0.7.0`, whose Zod range is 3.x. There is no patched 3.x release. Forcing Zod 4 across this API boundary is not a verified fix; the parent needs an upgrade. |
| `satori` 0.15.2 | moderate, [GHSA-wx4j-mvgx-mqwp](https://github.com/advisories/GHSA-wx4j-mvgx-mqwp) | `workers-og@0.0.27` embeds Satori in its distributed JavaScript. A manifest override would leave the embedded code unchanged; use a patched parent or a separately tested replacement. |

Raw audit and dependency-parent evidence is saved under `.orchestrate/evidence/`
for ticket 25. Deprecation/peer warnings from the SEO plugin and Code Block Pro
remain upstream compatibility work, rather than new overrides.

Wrangler telemetry remains disabled by `WRANGLER_SEND_METRICS=false` and Astro
telemetry by `ASTRO_TELEMETRY_DISABLED=1` in CI and the verification shell.
No additional analytics package is added.
