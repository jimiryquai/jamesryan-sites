import { getEmDashCollection, getEmDashEntry, type ContentEntry, type InferCollectionData, type ReferenceSelection, type SelectedReferences } from "emdash";
import { getPublishedEntries, type RequestCache } from "./content-query.ts";
import { getContentPath, resolveContentPath } from "./content-url.ts";
import { PUBLIC_COLLECTIONS, publicCollections, type PublicCollection } from "./public-collections.ts";

export type PublishedEntryRoute<S extends ReferenceSelection = ReferenceSelection> = {
	[C in PublicCollection]: {
		kind: "entry";
		collection: C;
		entry: ContentEntry<InferCollectionData<C>, SelectedReferences<C, S>>;
		title: string;
	}
}[PublicCollection];

export type PublishedRoute<S extends ReferenceSelection = ReferenceSelection> = PublishedEntryRoute<S> | {
	kind: "archive";
	collection: PublicCollection;
	title: string;
};

function entryRoute<S extends ReferenceSelection>(collection: PublicCollection, entry: ContentEntry<InferCollectionData<PublicCollection>, SelectedReferences<PublicCollection, S>>): PublishedEntryRoute<S> {
	return { kind: "entry", collection, entry, title: entry.data.title } as PublishedEntryRoute<S>;
}

// Pages have individual routes; the other collections also expose an archive.
function archivePath(collection: PublicCollection): string | null {
	return collection === "pages" ? null : `/${collection}`;
}

function archiveRoute(collection: PublicCollection): Extract<PublishedRoute, { kind: "archive" }> {
	return { kind: "archive", collection, title: PUBLIC_COLLECTIONS[collection] };
}

/**
 * What may this request render? EmDash authorizes single entries, including
 * verified draft previews/edit mode. Archives still require published entries.
 *
 * `references` is the selection `getEmDashEntry` resolves on the same fetch, so
 * a route that renders referenced content reads `entry.references` without a
 * second entry read; the returned cache hint covers the whole lookup.
 */
export async function getPublishedRoute<S extends ReferenceSelection = ReferenceSelection>(
	path: string,
	cache?: RequestCache,
	options?: { references?: S },
): Promise<PublishedRoute<S> | null> {
	const archive = publicCollections.find((collection) => archivePath(collection) === path);
	if (archive) {
		const result = await getEmDashCollection(archive, { status: "published", limit: 1 });
		if (result.error) throw result.error;
		if (cache?.enabled) cache.set(result.cacheHint);
		return result.entries.length ? archiveRoute(archive) : null;
	}
	const content = resolveContentPath(path);
	if (!content) return null;
	const result = await getEmDashEntry(content.collection, content.slug, { references: options?.references });
	if (result.error) throw result.error;
	if (cache?.enabled) cache.set(result.cacheHint);
	return result.entry ? entryRoute(content.collection, result.entry) : null;
}

/** What may the public discover? Always enumerate published entries/archives only. */
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
