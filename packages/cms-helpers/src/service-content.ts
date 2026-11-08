import {
	getEmDashCollection,
	getEmDashEntry,
	getEmDashReferences,
	type CacheHint,
	type ContentEntry,
	type InferCollectionData,
} from "emdash";

type ServiceCollection = "pricing" | "faqs" | "team" | "testimonials";

/** Resolve service-linked content through published references, not legacy columns. */
export async function getServiceEntries<T extends ServiceCollection>(
	collection: T,
	serviceSlug: string,
) {
	const service = await getEmDashEntry("services", serviceSlug);
	if (service.error) throw service.error;
	const entries: ContentEntry<InferCollectionData<T>>[] = [];
	const tags = new Set(service.cacheHint.tags);
	let lastModified = service.cacheHint.lastModified;

	function collectHint(hint: CacheHint | undefined) {
		for (const tag of hint?.tags ?? []) tags.add(tag);
		if (hint?.lastModified && (!lastModified || hint.lastModified > lastModified)) {
			lastModified = hint.lastModified;
		}
	}

	if (service.entry) {
		const serviceId = service.entry.data.id;
		let cursor: string | undefined;
		do {
			const page = await getEmDashCollection<T>(collection, { limit: 50, cursor });
			if (page.error) throw page.error;
			collectHint(page.cacheHint);
			// EmDash 1.4 has no reverse-reference collection filter. Read each
			// entry's service selection through the public API, including pages
			// beyond the first, so unrelated entries cannot hide a matching one.
			const selections = await Promise.all(page.entries.map((entry) =>
				getEmDashReferences(collection, entry.id, "service"),
			));
			for (const [index, selection] of selections.entries()) {
				if (selection.error) throw selection.error;
				collectHint(selection.cacheHint);
				if (selection.entries.some((linked) => linked.data.id === serviceId)) {
					entries.push(page.entries[index]);
				}
			}
			cursor = page.nextCursor;
		} while (cursor);
	}

	return {
		entries,
		cacheHint: { tags: [...tags], ...(lastModified ? { lastModified } : {}) },
	};
}
