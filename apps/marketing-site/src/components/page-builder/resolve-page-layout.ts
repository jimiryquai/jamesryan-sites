import type { Page } from "../../../emdash-env";

/** Everything a route needs to render a page's layout instead of its content. */
export interface PageLayoutContext {
	layout: NonNullable<Page["layout"]>;
	/** The services entry the page targets, as the page builder's group key. */
	group?: string;
}

/**
 * What layout does this page render, and which service group do its
 * shared-content blocks draw from? Pure read of the entry the route already
 * fetched: `getPublishedRoute` resolved the `service` reference selection on
 * that fetch, and its cache hint covers the read.
 */
export function resolvePageLayout(page: ContentEntryLike): PageLayoutContext | null {
	const layout = page.data.layout;
	if (!layout?.length) return null;
	const group = page.references?.service?.entries[0]?.data.id;
	return { layout, ...(group ? { group } : {}) };
}

/** The slice of a content entry this resolution reads. */
interface ContentEntryLike {
	id: string;
	data: Pick<Page, "layout">;
	references?: {
		service?: { entries: { data: { id: string } }[] };
	};
}
