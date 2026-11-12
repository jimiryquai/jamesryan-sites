import type { ContentEntry, InferCollectionData } from "emdash";
import { getPublishedEntries, type RequestCache } from "./content-query.ts";
import { getContentPath } from "./content-url.ts";

export type PublishedRoute = {
	collection: "pages" | "posts" | "projects";
	entry?: ContentEntry<InferCollectionData<"pages" | "posts" | "projects">>;
	title: string;
};

/** Public marketing routes, shared by rendering and discovery endpoints. */
export async function getPublishedRoutes(cache?: RequestCache): Promise<Map<string, PublishedRoute>> {
	const routes = new Map<string, PublishedRoute>();
	const collections = ["pages", "posts", "projects"] as const;
	const results = await Promise.all(collections.map((collection) => getPublishedEntries(collection, cache)));
	for (const [index, collection] of collections.entries()) {
		for (const entry of results[index]) {
			routes.set(getContentPath(collection, entry.id), { collection, entry, title: entry.data.title });
		}
	}
	// The posts archive is always available; the projects archive requires published work.
	routes.set("/posts", { collection: "posts", title: "Posts" });
	if (results[2].length) routes.set("/projects", { collection: "projects", title: "Work" });
	return routes;
}
