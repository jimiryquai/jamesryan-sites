# Dependency overrides

No dependency overrides remain with Astro 7, Cloudflare adapter 14 and EmDash 1.5.
The workspace lockfile owns resolved versions; `pnpm-workspace.yaml` owns the
release-age policy and its exceptions.

## Remaining audit findings

`pnpm audit` on 2026-11-12 reports two findings and no Astro advisory:

| Package | Severity | Why it remains |
| --- | --- | --- |
| `zod` 3.25.76 | high, [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | `@jdevalk/emdash-plugin-seo@0.12.0` depends on its own older `@jdevalk/astro-seo-graph@0.7.0`, whose Zod range is 3.x. There is no patched 3.x release. Forcing Zod 4 across this API boundary is not a verified fix; the parent needs an upgrade. |
| `satori` 0.15.2 | moderate, [GHSA-wx4j-mvgx-mqwp](https://github.com/advisories/GHSA-wx4j-mvgx-mqwp) | `workers-og@0.0.27` embeds Satori in its distributed JavaScript. A manifest override would leave the embedded code unchanged; use a patched parent or a separately tested replacement. |

Deprecation/peer warnings from the SEO plugin and Code Block Pro remain
upstream compatibility work, rather than new overrides.

For tool telemetry settings and the dated Wrangler audit, see
[Telemetry audit](mcp.md#telemetry-audit-checked-2026-11-12).
