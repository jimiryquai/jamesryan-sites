import { getEmDashEntry, type CacheHint } from "emdash";
import type { Page } from "../../../emdash-env";

/** Everything a route needs to render a page's layout instead of its content. */
export interface PageLayoutContext {
	layout: NonNullable<Page["layout"]>;
	/** The services entry the page targets, as the page builder's group key. */
	group?: string;
	/** What the service lookup read; fold it into the route's cache hint. */
	cacheHint?: CacheHint;
}

/**
 * What layout does this published page render, and which service group do its
 * shared-content blocks draw from? `getPublishedRoute` fetches the entry
 * without reference selections, so the service reference resolves here — one
 * request-cached entry read plus its link lookup, and only for a page that
 * actually has a layout.
 */
export async function resolvePageLayout(
	page: ContentEntryLike,
): Promise<PageLayoutContext | null> {
	const layout = page.data.layout;
	if (!layout?.length) return null;
	const result = await getEmDashEntry("pages", page.id, { references: { service: true } });
	if (result.error) throw result.error;
	const group = result.entry?.references?.service?.entries[0]?.data.id;
	return { layout, ...(group ? { group } : {}), cacheHint: result.cacheHint };
}
/** The slice of a content entry this resolution reads. */
interface ContentEntryLike {
	id: string;
	data: Pick<Page, "layout">;
}
