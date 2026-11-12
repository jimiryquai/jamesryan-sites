// THROWAWAY SPIKE (ticket 25): dev-only config override for the visual-editor
// experiment. Differences from astro.config.mjs:
//   - inspectorPort 0 (ephemeral): the shipped config hardcodes 9229, which a
//     second dev server cannot take (EADDRINUSE); nothing else on this machine
//     may be touched (esp. port 4331).
//   - persistState: an isolated state directory, so the experiment's D1/R2/KV
//     never mixes with any other worktree's .wrangler state.
// Run with: astro dev --config spike.config.mjs --port 4337
import cloudflare from "@astrojs/cloudflare";
import base from "./astro.config.mjs";

export default {
	...base,
	adapter: cloudflare({
		inspectorPort: 0,
		persistState: { path: new URL("./.spike-state", import.meta.url).pathname },
	}),
};
