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
	site: "https://jamesryan.dev",
	output: "server",
	adapter: cloudflare({ 
		imageService: "passthrough",
		inspectorPort: process.argv.includes("dev") ? 9229 : undefined 
	}),
	server: {
		port: 4321,
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
		domains: ["jamesryan.dev", "staging.jamesryan.dev", "localhost"],
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.jamesryan.dev",
			},
		],
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
				title: "James Ryan",
				siteUrl: "https://jamesryan.dev",
				summary: "James Ryan - Senior Marketer & Full-Stack AI Engineer portfolio, featuring case studies on marketing orchestration, custom plugins, and developer tool integrations.",
				details: "This site presents case studies, technical deep-dives, blog posts, and resources regarding modern AI engineering, CMS solutions (like EmDash), and marketing infrastructure.",
				sections: [
					{
						name: "Main Pages",
						links: [
							{
								url: "https://jamesryan.dev/",
								title: "Home",
								description: "Introduction, core principles, featured case studies, and latest articles."
							},
							{
								url: "https://jamesryan.dev/about",
								title: "About",
								description: "Details on background, skill set, and experience in engineering and marketing."
							},
							{
								url: "https://jamesryan.dev/contact",
								title: "Contact",
								description: "Get in touch for consultations, speaking engagements, or collaborations."
							},
							{
								url: "https://jamesryan.dev/pricing",
								title: "Pricing & Services",
								description: "Service offerings, consulting models, and package plans."
							}
						]
					},
					{
						name: "Blog & Articles",
						links: [
							{
								url: "https://jamesryan.dev/posts",
								title: "All Articles",
								description: "Archive of all published writing, thoughts, and technical deep-dives."
							}
						]
					}
				]
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
				{
					id: "marketing-blocks",
					version: "0.1.0",
					// Absolute file:// URL so the virtual emdash/plugins module
					// can resolve this at build time (relative paths fail because
					// the virtual module has no on-disk location to anchor them).
					entrypoint: new URL("./src/plugins/marketing-blocks/index.ts", import.meta.url).href,
					adminEntry: new URL("./src/plugins/marketing-blocks/admin.tsx", import.meta.url).href,
				},
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
