import { getViteConfig } from "astro/config";

// Use Astro's Vite pipeline so .astro component imports resolve correctly.
export default getViteConfig({
	plugins: [
		{
			name: "mock-virtual-emdash",
			resolveId(id) {
				if (id.startsWith("virtual:emdash/")) {
					return "\0" + id;
				}
			},
			load(id) {
				if (id === "\0virtual:emdash/config") {
					return "export default { i18n: { defaultLocale: 'en', locales: ['en'] } };";
				}
				if (id === "\0virtual:emdash/seed") {
					return "export default null;";
				}
				if (id === "\0virtual:emdash/dialect") {
					return "export default null;";
				}
			}
		}
	],
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
		testTimeout: 30_000,
		globals: true,
	},
});
