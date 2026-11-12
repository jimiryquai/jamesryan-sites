import { getContentPath, discoveryResponse, runPublishedOnly } from "@jamesryan/cms-helpers";
import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettingsWithCacheHint } from "emdash";

import { resolveBlogSiteIdentity } from "../utils/site-identity.ts";

export const GET: APIRoute = async ({ site, url, cache }) => {
	const siteUrl = (site?.toString() || url.origin).replace(/\/+$/, "");
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
	const { siteTitle, siteTagline } = resolveBlogSiteIdentity(settingsResult.data);
	const posts = postsResult.entries;

	const items = posts
		.map((post) => {
			if (!post.data.publishedAt) return null;
			const pubDate = post.data.publishedAt.toUTCString();

			const postUrl = new URL(getContentPath("posts", post.id), siteUrl).href;
			const title = escapeXml(post.data.title || "Untitled");
			const description = escapeXml(post.data.excerpt || "");

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
