import { getContentPath } from "./content-url.ts";
import { discoveryResponse } from "./discovery-response.ts";
import { runPublishedOnly } from "./content-query.ts";
import { getSchemaCollections } from "./schema-collections.ts";
import { createSchemaMap, createApiCatalog } from "@jdevalk/astro-seo-graph";
import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettingsWithCacheHint } from "emdash";

import { resolveSiteIdentity } from "./site-identity.ts";

export const rss: APIRoute = async ({ site, url, cache }) => {
	const { siteUrl } = resolveSiteIdentity(undefined, { site, requestUrl: url });
	const [settingsResult, postsResult] = await runPublishedOnly(() => Promise.all([
		getSiteSettingsWithCacheHint(),
		getEmDashCollection("posts", {
			status: "published", orderBy: { published_at: "desc" }, limit: 20,
		}),
	]));
	if (cache?.enabled) {
		cache.set(settingsResult.cacheHint);
		cache.set(postsResult.cacheHint);
	}
	const { siteTitle, siteTagline } = resolveSiteIdentity(settingsResult.data, { site, requestUrl: url });
	if (postsResult.error) throw postsResult.error;
	const posts = postsResult.entries;

	const items = posts
		.map((post) => {
			if (!(post.data.publishedAt instanceof Date)) return null;
			const pubDate = post.data.publishedAt.toUTCString();

			const postUrl = new URL(getContentPath("posts", post.id), siteUrl).href;
			const title = escapeXml(typeof post.data.title === "string" ? post.data.title : "Untitled");
			const description = escapeXml(typeof post.data.excerpt === "string" ? post.data.excerpt : "");

			return `    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
		})
		.filter(Boolean)
		.join("\n");

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <description>${escapeXml(siteTagline)}</description>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

	return discoveryResponse(new Response(rss, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	}), cache);
};

const XML_ESCAPE_PATTERNS = [
	[/&/g, "&amp;"],
	[/</g, "&lt;"],
	[/>/g, "&gt;"],
	[/"/g, "&quot;"],
	[/'/g, "&apos;"],
] as const;

function escapeXml(str: string): string {
	let result = str;
	for (const [pattern, replacement] of XML_ESCAPE_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}

export const robots: APIRoute = async ({ site, url }) => {
	const { siteUrl } = resolveSiteIdentity(undefined, { site, requestUrl: url });

	const body = `# Content-Signal: ai-train=no, search=yes, ai-input=yes
User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
Sitemap: ${siteUrl}/schemamap.xml
`;

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
			"Content-Signal": "ai-train=no, search=yes, ai-input=yes",
		},
	});
};

export const schemaMap: APIRoute = async (context) => {
	const { siteUrl } = resolveSiteIdentity(undefined, { site: context.site, requestUrl: context.url });
	const entries = await getSchemaCollections(context.cache);
	const handler = createSchemaMap({ siteUrl, entries });
	return discoveryResponse(await handler(context), context.cache, 300);
};

export const apiCatalog: APIRoute = async (context) => {
	const { siteUrl } = resolveSiteIdentity(undefined, { site: context.site, requestUrl: context.url });
	const schemaEndpoints = await getSchemaCollections(context.cache);
	const handler = createApiCatalog({ siteUrl, schemaEndpoints, schemaMap: { path: "/schemamap.xml" } });
	return discoveryResponse(await handler(context), context.cache, 300);
};
