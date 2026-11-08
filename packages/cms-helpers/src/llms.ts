import { renderLlmsTxt } from "@jdevalk/astro-seo-graph";
import {
	getEmDashCollection,
	getSiteSettingsWithCacheHint,
	type CacheHint,
} from "emdash";

type RequestCache = { enabled: boolean; set: (hint: CacheHint) => void };

async function getPublishedLlmsSections(origin: string, cache: RequestCache) {
	const sections = [];

	for (const collection of ["pages", "posts"] as const) {
		const links = [];
		let cursor: string | undefined;
		do {
			const result = await getEmDashCollection(collection, {
				status: "published",
				limit: 100,
				cursor,
			});
			if (result.error) throw result.error;
			if (cache.enabled) cache.set(result.cacheHint);
			for (const entry of result.entries) {
				const path = `/${collection}/${encodeURIComponent(entry.id)}`;
				const description = "excerpt" in entry.data && typeof entry.data.excerpt === "string"
					? entry.data.excerpt
					: undefined;
				links.push({
					title: entry.data.title,
					url: new URL(path, origin).href,
					description,
				});
			}
			cursor = result.nextCursor;
		} while (cursor);
		sections.push({ name: collection === "pages" ? "Pages" : "Posts", links });
	}

	return sections;
}

export async function getLlmsTxt(origin: string, cache: RequestCache): Promise<Response> {
	try {
		const [{ data: settings, cacheHint }, sections] = await Promise.all([
			getSiteSettingsWithCacheHint(),
			getPublishedLlmsSections(origin, cache),
		]);
		if (cache.enabled) cache.set(cacheHint);
		return new Response(renderLlmsTxt({
			title: settings.title || "Site",
			summary: settings.tagline || undefined,
			sections,
		}), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
	} catch (error) {
		console.error("Failed to generate llms.txt", error);
		return new Response("Unable to load content", { status: 500 });
	}
}
