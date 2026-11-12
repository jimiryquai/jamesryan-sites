import { getEmDashCollection, getEmDashEntry, type ContentEntry, type InferCollectionData } from "emdash";
import { getPublishedEntries, type RequestCache } from "./content-query.ts";
import { getContentPath, resolveContentPath } from "./content-url.ts";
import { PUBLIC_COLLECTIONS, publicCollections, type PublicCollection } from "./public-collections.ts";

export type PublishedEntryRoute = {
	[C in PublicCollection]: {
		kind: "entry";
		collection: C;
		entry: ContentEntry<InferCollectionData<C>>;
		title: string;
	}
}[PublicCollection];

export type PublishedRoute = PublishedEntryRoute | {
	kind: "archive";
	collection: PublicCollection;
	title: string;
};

function entryRoute<C extends PublicCollection>(collection: C, entry: ContentEntry<InferCollectionData<C>>): PublishedEntryRoute {
	return { kind: "entry", collection, entry, title: entry.data.title } as PublishedEntryRoute;
}

// Pages have individual routes; the other collections also expose an archive.
function archivePath(collection: PublicCollection): string | null {
	return collection === "pages" ? null : `/${collection}`;
}

function archiveRoute(collection: PublicCollection): PublishedRoute {
	return { kind: "archive", collection, title: PUBLIC_COLLECTIONS[collection] };
}

/** Resolve one public route with one targeted CMS query, including entry SEO. */
export async function getPublishedRoute(path: string, cache?: RequestCache): Promise<PublishedRoute | null> {
	const archive = publicCollections.find((collection) => archivePath(collection) === path);
	if (archive) {
		const result = await getEmDashCollection(archive, { status: "published", limit: 1 });
		if (result.error) throw result.error;
		if (cache?.enabled) cache.set(result.cacheHint);
		return result.entries.length ? archiveRoute(archive) : null;
	}
	const content = resolveContentPath(path);
	if (!content) return null;
	const result = await getEmDashEntry(content.collection, content.slug);
	if (result.error) throw result.error;
	if (cache?.enabled) cache.set(result.cacheHint);
	return result.entry?.data.status === "published" ? entryRoute(content.collection, result.entry) : null;
}

/** Enumerate the same published entry/archive rule for discovery endpoints. */
export async function getPublishedRoutes(cache?: RequestCache): Promise<Map<string, PublishedRoute>> {
	const routes = new Map<string, PublishedRoute>();
	await Promise.all(publicCollections.map(async (collection) => {
		const entries = await getPublishedEntries(collection, cache);
		for (const entry of entries) {
			routes.set(getContentPath(collection, entry.id), entryRoute(collection, entry));
		}
		const path = archivePath(collection);
		if (path && entries.length) routes.set(path, archiveRoute(collection));
	}));
	return routes;
}
