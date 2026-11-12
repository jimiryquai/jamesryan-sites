import {
	getEmDashCollection,
	type CacheHint,
	type ContentEntry,
	type InferCollectionData,
} from "emdash";

import type { PublicCollection } from "./public-collections.ts";

export type RequestCache = { enabled: boolean; set: (hint: CacheHint) => void };

export async function getPublishedEntries<T extends PublicCollection>(
	collection: T,
	cache?: RequestCache,
): Promise<ContentEntry<InferCollectionData<T>>[]> {
	const entries: ContentEntry<InferCollectionData<T>>[] = [];
	let cursor: string | undefined;
	do {
		const result = await getEmDashCollection(collection, {
			status: "published",
			limit: 100,
			cursor,
		});
		if (result.error) throw result.error;
		if (cache?.enabled) cache.set(result.cacheHint);
		entries.push(...result.entries);
		cursor = result.nextCursor;
	} while (cursor);
	return entries;
}
