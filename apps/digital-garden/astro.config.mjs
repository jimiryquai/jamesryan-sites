// Keep the factory in Astro’s config bundle to transform TypeScript plugin entries.
import { createSiteConfig } from "../../packages/astro-config/index.mjs";

export default createSiteConfig({
	site: "https://jamesryan.me",
	port: 4322,
	inspectorPort: 9230,
	displayFont: { name: "Familjen Grotesk", weights: [400, 500, 600, 700], fallbacks: ["sans-serif"] },
	redirects: { "/blog": "/" },
	appRootUrl: import.meta.url,
});
