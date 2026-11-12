import { getEmDashCollection } from "emdash";
import { publicCollections } from "./public-collections.ts";
import { runPublishedOnly, type RequestCache } from "./content-query.ts";

/** Schema discovery lists exactly the collections with published entries. */
export async function getSchemaCollections(cache?: RequestCache) {
	return runPublishedOnly(async () => {
		const collections = await Promise.all(publicCollections.map(async (collection) => {
			const result = await getEmDashCollection(collection, {
				status: "published", orderBy: { updated_at: "desc" }, limit: 1,
			});
			if (result.error) throw result.error;
			if (cache?.enabled) cache.set(result.cacheHint);
			const entry = result.entries[0];
			return entry ? {
				path: `/schema/${collection}.json`,
				schemaType: collection === "posts" ? "BlogPosting" : "WebPage",
				lastModified: entry.data.updatedAt instanceof Date || typeof entry.data.updatedAt === "string" ? new Date(entry.data.updatedAt) : new Date(),
			} : null;
		}));
		return collections.filter((collection) => collection !== null);
	});
}
