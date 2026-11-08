import { renderLlmsTxt } from "@jdevalk/astro-seo-graph";
import { getSiteSettingsWithCacheHint } from "emdash";
import { getPublishedEntries, type RequestCache } from "./content-query.ts";
import { getContentPath } from "./content-url.ts";

async function getPublishedLlmsSections(origin: string, cache: RequestCache) {
	const sections = [];

	for (const collection of ["pages", "posts"] as const) {
		const links = [];
		const entries = await getPublishedEntries(collection, cache);
		for (const entry of entries) {
			const path = getContentPath(collection, entry.id);
			const description = "excerpt" in entry.data && typeof entry.data.excerpt === "string"
				? entry.data.excerpt
				: undefined;
			links.push({
				title: entry.data.title,
				url: new URL(path, origin).href,
				description,
			});
		}
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
