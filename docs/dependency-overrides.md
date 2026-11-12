# Dependency overrides

The workspace lockfile is the source of resolved versions; `pnpm-workspace.yaml`
owns the overrides. Prefer updating dependencies within their ranges. These
exceptions remain necessary with Astro 6.4.8, Cloudflare adapter 13.7.0 and
EmDash 1.4.0 held for ticket 25. Remove each security override when every parent
in the supported graph accepts the patched version, then reinstall and audit.
The 24-hour release-age policy and its exclusions are unchanged.

| Override | Advisory | Why an override; removal condition |
| --- | --- | --- |
| `zod@>=4 <4.6.6` → `4.6.7` | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | EmDash's auth/plugin-types packages pin 4.5.4. Remove when the permitted EmDash release uses patched Zod. This deliberately preserves Zod 3 for the SEO plugin's older graph package: no patched 3.x release exists, and a forced major upgrade is not a safe substitute. |
| `sharp` → `0.35.5` | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | Astro 6 and the adapter's old Miniflare constrain sharp to 0.34. Remove when both accept at least 0.35.5. New Wrangler fixes its own copy but cannot replace the adapter's Miniflare. Production uses Cloudflare Images; sharp is build/local tooling. |
| `undici@7` → `7.30.2` | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26), [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx), [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) and earlier Undici advisories in the audit evidence | The adapter's pinned Miniflare pins 7.24.8. Remove when the permitted adapter's Miniflare pins at least 7.30.1. Restrict to 7.x so the independently updated font tooling's Undici 8 stays on its supported major. |
| `ws` → `8.22.2` | [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Adapter's pinned Vite plugin and Miniflare pin 8.20.1. Remove when their permitted releases use at least 8.21.0. |
| `esbuild` → `0.28.2` | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | Astro 6 constrains esbuild to 0.27. Remove when the permitted Astro release accepts at least 0.28.1. Wrangler's own copy is fixed by its direct upgrade. |

The pre-existing `@astrojs/cloudflare>@cloudflare/vite-plugin` pin to `1.39.0`
is an adapter compatibility constraint, not a new security override. Revisit
with the Astro/adapter upgrade in ticket 25. The former Tiptap subscript and
superscript pins were removed so both follow the editor's supported 3.x range
and resolve alongside the patched core.

`workers-og@0.0.27` embeds Satori in its distributed JavaScript. Overriding its
manifest's Satori dependency would leave that embedded code unchanged; its
moderate advisory therefore remains until a patched parent is published or a
separately tested replacement is adopted. The remaining moderate Satori finding is reported rather than hidden by
an override.

Wrangler telemetry remains disabled by `WRANGLER_SEND_METRICS=false` and Astro
telemetry by `ASTRO_TELEMETRY_DISABLED=1` in CI and the verification shell.
Wrangler's npm update check already existed in 4.99.0; it is not introduced by
this upgrade. No additional analytics package is added.
