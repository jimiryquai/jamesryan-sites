import type { APIRoute } from "astro";
import { getSiteSettingsWithCacheHint } from "emdash";
import { getPublishedEntries, getContentPath, publicCollections, discoveryResponse } from "@jamesryan/cms-helpers";
import { buildSiteGraph } from "@jamesryan/ui/seo-graph";
import { assembleGraph, buildWebPage, buildArticle } from "@jdevalk/seo-graph-core";

export const GET: APIRoute = async ({ params, site, url, cache }) => {
	const collection = publicCollections.find((name) => name === params.collection);
	if (!collection) return discoveryResponse(new Response("Not found", { status: 404 }), cache, 60);
	const siteUrl = (site?.toString() || url.origin).replace(/\/+$/, "");
	const entries = await getPublishedEntries(collection, cache);
	const { data: settings, cacheHint } = await getSiteSettingsWithCacheHint();
	if (cache?.enabled) cache.set(cacheHint);
	if (!entries.length) return discoveryResponse(new Response("Not found", { status: 404 }), cache, 60);
	const siteTitle = settings?.title || "James Ryan";
	const siteDescription = settings?.tagline || "AI-native marketer & engineer";
	const { ids, blogId, pieces: allPieces } = buildSiteGraph(siteUrl, siteTitle, siteDescription);

	for (const entry of entries) {
		const entryUrl = new URL(getContentPath(collection, entry.id), siteUrl).href;
		const data = entry.data as unknown as Record<string, unknown>;
		const title = (typeof data.title === "string" ? data.title : null) || (typeof data.quote === "string" ? data.quote : null) || "Untitled";
		const desc = (typeof data.excerpt === "string" ? data.excerpt : null) || (typeof data.author === "string" ? data.author : null) || "";

		const pagePiece = buildWebPage({
			url: entryUrl,
			name: title,
			isPartOf: { "@id": ids.website },
			breadcrumb: { "@id": ids.breadcrumb(entryUrl) },
			datePublished: entry.data.publishedAt ? new Date(entry.data.publishedAt) : undefined,
			dateModified: entry.data.updatedAt ? new Date(entry.data.updatedAt) : undefined,
		}, ids);

		allPieces.push(pagePiece);

		if (collection === "posts") {
			const articlePiece = buildArticle({
				url: entryUrl,
				isPartOf: [
					{ "@id": ids.webPage(entryUrl) },
					{ "@id": blogId }
				] as unknown as { "@id": string },
				author: { "@id": ids.person },
				publisher: { "@id": ids.person },
				headline: title,
				description: desc,
				datePublished: entry.data.publishedAt ? new Date(entry.data.publishedAt) : new Date(),
				dateModified: entry.data.updatedAt ? new Date(entry.data.updatedAt) : undefined,
			}, ids, "BlogPosting");
			allPieces.push(articlePiece);
		}
	}

	const graph = assembleGraph(allPieces);

	return discoveryResponse(new Response(JSON.stringify(graph, null, 2), {
		headers: {
			"Content-Type": "application/ld+json; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	}), cache, 300);
};
