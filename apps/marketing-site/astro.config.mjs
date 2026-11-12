import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import icon from "astro-iconset";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";
import tailwind from "@tailwindcss/vite";
import pageBuilderPlugin from "emdash-plugin-page-builder/plugin";
import seoPlugin from "@jdevalk/emdash-plugin-seo";
import seoGraph from "@jdevalk/astro-seo-graph/integration";
import { codeBlockProPlugin } from "emdash-plugin-code-block-pro";
import aiCommentModeration from "emdash-plugin-ai-comment-moderation";

const site = "https://jamesryan.dev";
const hostname = new URL(site).hostname;

// THROWAWAY SPIKE (ticket 25): local copy of DavesAgenda/emdash-visual-editor
// @08a5e75 (MIT), adapted to the pages.layout field — see
// src/plugins/visual-editor/ADAPTATIONS.md. Nothing here merges.
const visualEditorSpike = () => ({
	id: "visual-editor",
	version: "1.0.0",
	format: "native",
	entrypoint: new URL("./src/plugins/visual-editor/index.ts", import.meta.url).pathname,
	adminEntry: new URL("./src/plugins/visual-editor/admin.tsx", import.meta.url).pathname,
	adminPages: [{ path: "/", label: "Visual editor", icon: "paint-brush" }],
});

export default defineConfig({
	site,
	output: "server",
	// Preserve inline spacing from Astro 6 across the compiler upgrade.
	compressHTML: true,
	adapter: cloudflare({ 
		inspectorPort: process.argv.includes("dev") ? 9229 : false 
	}),
	server: {
		port: 4321,
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
		domains: [hostname, `staging.${hostname}`, "localhost"],
		remotePatterns: [
			{
				protocol: "https",
				hostname: `**.${hostname}`,
			},
		],
	},
	vite: {
		plugins: [tailwind()],
		server: {
			watch: {
				ignored: ["**/.wrangler/**"],
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
			markdownAlternate: true,
		}),

		icon({
			// Only ship the Phosphor icons actually referenced in templates,
			// not the full @iconify-json/ph set (which adds megabytes to the
			// deployed worker bundle).
			include: {
				ph: [
					"sun",
					"moon",
					"circle-half",
					"check",
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
			migrations: { runtime: "check", dev: "auto" },
			storage: r2({ binding: "MEDIA" }),
			sandboxRunner: sandbox(),
			sandboxed: [aiCommentModeration],
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
				pageBuilderPlugin(),
				visualEditorSpike(),
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
			name: "Instrument Serif",
			cssVariable: "--font-display",
			weights: [400],
			fallbacks: ["serif"],
		},
	],
	devToolbar: { enabled: false },
});
