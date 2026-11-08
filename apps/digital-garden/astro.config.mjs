import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import icon from "astro-iconset";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";
import tailwind from "@tailwindcss/vite";
import seoPlugin from "@jdevalk/emdash-plugin-seo";
import seoGraph from "@jdevalk/astro-seo-graph/integration";
import { codeBlockProPlugin } from "emdash-plugin-code-block-pro";

const site = "https://jamesryan.me";
const hostname = new URL(site).hostname;

export default defineConfig({
	site,
	output: "server",
	adapter: cloudflare({ inspectorPort: process.argv.includes("dev") ? 9230 : false }),
	server: {
		port: 4322,
	},
	redirects: {
		"/blog": "/",
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
		domains: [hostname, `staging.${hostname}`, "localhost"],
		remotePatterns: [{ protocol: "https", hostname: `**.${hostname}` }],
	},
	vite: {
		plugins: [tailwind()],
		server: {
			watch: {
				ignored: ["**/.wrangler/**"],
			},
			fs: {
				allow: [
					new URL("../../../", import.meta.url).pathname,
				],
			},
		},
		ssr: {
			optimizeDeps: {
				// EmDash owns its core dependencies; these app dependencies still
				// trigger worker reloads when first discovered during a render.
				include: [
					"astro-iconset/components",
					"@jdevalk/astro-seo-graph",
					"@jdevalk/seo-graph-core",
					"clsx/lite",
					"workers-og",
				],
			},
		},
	},
	integrations: [
		react(),
		seoGraph({
			validateH1: true,
			validateUniqueMetadata: true,
			validateImageAlt: true,
			validateMetadataLength: true,
			validateInternalLinks: {
				skip: (href) => href.startsWith("/api/") || href.startsWith("/_emdash/"),
			},
			llmsTxt: {
				title: "Oatmeal Digital Garden",
				siteUrl: site,
			},
			markdownAlternate: true,
		}),

		icon({
			// Only ship the Phosphor icons actually referenced in templates,
			// not the full @iconify-json/ph set (which adds megabytes to the
			// deployed worker bundle).
			include: {
				ph: [
					"chart-bar",
					"check-circle",
					"clock",
					"cloud",
					"code",
					"currency-dollar",
					"envelope",
					"globe",
					"heart",
					"lifebuoy",
					"lightning",
					"lock",
					"shield-check",
					"sparkle",
					"star",
					"users-three",
				],
			},
		}),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			sandboxRunner: sandbox(),
			mcp: true,
			plugins: [
				(() => {
					// SEO 0.12's descriptor paths are stripped by EmDash 1.4's definePlugin.
					const seo = seoPlugin();
					seo.entrypoint = new URL("./node_modules/@jdevalk/emdash-plugin-seo/src/index.ts", import.meta.url).href;
					seo.adminEntry = new URL("./node_modules/@jdevalk/emdash-plugin-seo/src/admin.tsx", import.meta.url).href;
					return seo;
				})(),
				codeBlockProPlugin(),
			],
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-sans",
			weights: [400, 500, 600, 700, 800],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "Familjen Grotesk",
			cssVariable: "--font-display",
			weights: [400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
	],
	devToolbar: { enabled: false },
});
