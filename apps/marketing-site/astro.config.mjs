// Keep the factory in Astro’s config bundle to transform TypeScript plugin entries.
import { createSiteConfig } from "../../packages/astro-config/index.mjs";
import pageBuilderPlugin from "emdash-plugin-page-builder/plugin";
import aiCommentModeration from "emdash-plugin-ai-comment-moderation";

export default createSiteConfig({
	site: "https://jamesryan.dev",
	port: 4321,
	inspectorPort: 9229,
	displayFont: { name: "Instrument Serif", weights: [400], fallbacks: ["serif"] },
	extraPlugins: [pageBuilderPlugin()],
	sandboxedPlugins: [aiCommentModeration],
	appRootUrl: import.meta.url,
});
