import { renderLlmsTxt } from "@jdevalk/astro-seo-graph";
import { getSiteSettingsWithCacheHint } from "emdash";
import { getPublishedEntries, type RequestCache } from "./content-query.ts";
import type { PublishedRoute } from "./published-routes.ts";
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

function getRouteSections(origin: string, routes: Map<string, PublishedRoute>) {
	return (["pages", "posts", "projects"] as const).map((collection) => ({
		name: { pages: "Pages", posts: "Posts", projects: "Projects" }[collection],
		links: [...routes].filter(([, route]) => route.collection === collection).map(([path, route]) => {
			const data = route.entry?.data;
			return {
				title: route.title,
				url: new URL(path, origin).href,
				description: data && "excerpt" in data && typeof data.excerpt === "string" ? data.excerpt : undefined,
			};
		}),
	}));
}

export async function getLlmsTxt(origin: string, cache: RequestCache, routes?: Map<string, PublishedRoute>): Promise<Response> {
	try {
		const [{ data: settings, cacheHint }, sections] = await Promise.all([
			getSiteSettingsWithCacheHint(),
			routes ? getRouteSections(origin, routes) : getPublishedLlmsSections(origin, cache),
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
