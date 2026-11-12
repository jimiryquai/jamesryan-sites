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

/** Shared platform wiring; callers supply only deployment differences. */
export function createSiteConfig({
	site, port, inspectorPort, appRootUrl, redirects, displayFont,
	extraPlugins = [], sandboxedPlugins = [],
}) {
	const hostname = new URL(site).hostname;
	return defineConfig({
		site,
		redirects,
		output: "server",
		// Preserve inline spacing from Astro 6 across the compiler upgrade.
		compressHTML: true,
		adapter: cloudflare({
			inspectorPort: process.argv.includes("dev") ? inspectorPort : false
		}),
		server: {
			port,
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
				sandboxed: sandboxedPlugins,
				mcp: true,
				plugins: [
					(() => {
						// SEO 0.12's descriptor paths are stripped by EmDash 1.4's definePlugin.
						const seo = seoPlugin();
						seo.entrypoint = new URL("./node_modules/@jdevalk/emdash-plugin-seo/src/index.ts", appRootUrl).href;
						seo.adminEntry = new URL("./node_modules/@jdevalk/emdash-plugin-seo/src/admin.tsx", appRootUrl).href;
						return seo;
					})(),
					codeBlockProPlugin(),
					...extraPlugins,
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
			{ provider: fontProviders.google(), cssVariable: "--font-display", ...displayFont },
		],
		devToolbar: { enabled: false },
	});
}
