import {
	getEmDashCollection,
	getRequestContext,
	runWithContext,
	type CacheHint,
	type ContentEntry,
	type InferCollectionData,
} from "emdash";

import type { PublicCollection } from "./public-collections.ts";

export type RequestCache = { enabled: boolean; set: (hint: CacheHint) => void };

/** Keep published discovery on live revisions without changing the caller's session. */
export function runPublishedOnly<T>(fn: () => Promise<T>): Promise<T> {
	const context = getRequestContext();
	return context?.editMode || context?.preview
		? runWithContext({ ...context, editMode: false, preview: undefined }, fn)
		: fn();
}

export async function getPublishedEntries<T extends PublicCollection>(
	collection: T,
	cache?: RequestCache,
): Promise<ContentEntry<InferCollectionData<T>>[]> {
	return runPublishedOnly(async () => {
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
	});
}
