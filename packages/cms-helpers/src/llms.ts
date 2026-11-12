import { renderLlmsTxt } from "@jdevalk/astro-seo-graph";
import { getSiteSettingsWithCacheHint } from "emdash";
import { getPublishedEntries, type RequestCache } from "./content-query.ts";
import { getPublishedRoutes, type PublishedRoute } from "./published-routes.ts";
import { PUBLIC_COLLECTIONS, publicCollections } from "./public-collections.ts";
import { getContentPath } from "./content-url.ts";

function getExcerpt(data?: object): string | undefined {
	return data && "excerpt" in data && typeof data.excerpt === "string" ? data.excerpt : undefined;
}

async function getGardenSections(origin: string, cache: RequestCache) {
	const sections = [];

	for (const collection of publicCollections.filter((collection) => collection !== "projects")) {
		const links = [];
		const entries = await getPublishedEntries(collection, cache);
		for (const entry of entries) {
			const path = getContentPath(collection, entry.id);
			const description = getExcerpt(entry.data);
			links.push({
				title: entry.data.title,
				url: new URL(path, origin).href,
				description,
			});
		}
		sections.push({ name: PUBLIC_COLLECTIONS[collection], links });
	}

	return sections;
}

function getRouteSections(origin: string, routes: Map<string, PublishedRoute>) {
	return publicCollections.map((collection) => ({
		name: PUBLIC_COLLECTIONS[collection],
		links: [...routes].filter(([, route]) => route.collection === collection).map(([path, route]) => {
			const data = route.kind === "entry" ? route.entry.data : undefined;
			return {
				title: route.title,
				url: new URL(path, origin).href,
				description: getExcerpt(data),
			};
		}),
	}));
}

async function respond(origin: string, cache: RequestCache, sectionsPromise: Promise<ReturnType<typeof getRouteSections>>): Promise<Response> {
	try {
		const [{ data: settings, cacheHint }, sections] = await Promise.all([
			getSiteSettingsWithCacheHint(),
			sectionsPromise,
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

/** Marketing discovery uses only the shared published-route map. */
export function getLlmsTxt(origin: string, cache: RequestCache): Promise<Response> {
	return respond(origin, cache, getPublishedRoutes(cache).then((routes) => getRouteSections(origin, routes)));
}

/** Garden-only legacy discovery, until the garden adopts published-route gating. */
export function getGardenLlmsTxt(origin: string, cache: RequestCache): Promise<Response> {
	return respond(origin, cache, getGardenSections(origin, cache));
}
