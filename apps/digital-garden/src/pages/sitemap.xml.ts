import type { APIRoute } from "astro";
import { getContentPath, getPublishedEntries } from "@jamesryan/cms-helpers";

export const GET: APIRoute = async ({ site, url, cache }) => {
	const siteUrl = site?.toString().replace(/\/$/, "") || url.origin;

	// Fetch dynamic content from EmDash collections
	const [pages, posts, projects] = await Promise.all([
		getPublishedEntries("pages", cache),
		getPublishedEntries("posts", cache),
		getPublishedEntries("projects", cache),
	]);

	const urls: string[] = [];

	// The project archive exists when it has published entries.
	if (projects.length > 0) urls.push(`${siteUrl}/projects`);

	// Add dynamic pages
	for (const page of pages) {
		urls.push(new URL(getContentPath("pages", page.id), siteUrl).href);
	}

	// Add blog posts
	for (const post of posts) {
		urls.push(new URL(getContentPath("posts", post.id), siteUrl).href);
	}

	// Add projects
	for (const project of projects) {
		urls.push(new URL(getContentPath("projects", project.id), siteUrl).href);
	}

	// Build sitemap XML
	const xmlUrls = urls
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
