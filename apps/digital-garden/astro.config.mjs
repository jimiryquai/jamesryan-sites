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

export default defineConfig({
	site: "https://garden.oatmeal.dev",
	output: "server",
	adapter: cloudflare({ inspectorPort: process.argv.includes("dev") ? 9230 : undefined }),
	server: {
		port: 4322,
	},
	redirects: {
		"/blog": "/",
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
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
			noExternal: [],
			optimizeDeps: {
				// Pre-bundle so it isn't discovered mid-render, which would trigger
				// a Vite dep re-optimization and break in-flight worker imports
				// under the Cloudflare dev runner (workerd).
				include: [
					"astro-iconset/components",
					"emdash/middleware",
					"emdash/middleware/redirect",
					"emdash/middleware/setup",
					"emdash/middleware/auth",
					"emdash/middleware/request-context",
					"emdash/media/local-runtime",
					"@emdash-cms/cloudflare/db/d1",
					"@emdash-cms/cloudflare/storage/r2",
					"emdash/ui",
					"emdash/runtime",
					"emdash/routes/PluginRegistry",
					"astro/zod",
					"emdash/page",
					"@jdevalk/seo-graph-core",
					"clsx/lite",
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
				siteUrl: "https://garden.oatmeal.dev",
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
