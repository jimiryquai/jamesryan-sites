import type { APIRoute } from "astro";
import { getPublishedRoutes } from "@jamesryan/cms-helpers";

export const GET: APIRoute = async ({ site, url, cache }) => {
	const siteUrl = site?.toString().replace(/\/$/, "") || url.origin;

	const routes = await getPublishedRoutes(cache);
	const urls = [...routes.keys()].map((path) => new URL(path, siteUrl).href);

	// Build sitemap XML
	const xmlUrls = [...new Set(urls)]
		.map((u) => `  <url><loc>${u}</loc></url>`)
		.join("\n");

	const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

	return new Response(sitemapXml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
};
