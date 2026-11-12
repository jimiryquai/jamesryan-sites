import { decodeSlug, getTerm, getEmDashCollection, getTermsForEntries, type PortableTextBlock, type ContentBylineCredit, type MediaValue } from "emdash";
import { runPublishedOnly, type RequestCache } from "./content-query.ts";

/** Fields used by archive cards, independent of either app's generated schema. */
interface ArchivePost {
	id: string;
	title?: string;
	excerpt?: string;
	featured_image?: MediaValue;
	publishedAt?: Date | null;
	content?: PortableTextBlock[];
	bylines?: ContentBylineCredit[];
}

/** Resolve a taxonomy archive against published revisions, including during preview. */
export async function getTaxonomyArchive(taxonomy: "category" | "tag", rawSlug?: string, cache?: RequestCache) {
	const slug = decodeSlug(rawSlug);
	const term = slug ? await getTerm(taxonomy, slug) : null;
	if (!term) return null;

	return runPublishedOnly(async () => {
		const { entries, cacheHint, error } = await getEmDashCollection<"posts", ArchivePost>("posts", {
			status: "published",
			where: { [taxonomy]: term.slug },
			orderBy: { published_at: "desc" },
		});
		if (error) throw error;
		if (cache?.enabled) cache.set(cacheHint);
		const tagsByEntry = await getTermsForEntries("posts", entries.map(post => post.data.id), "tag");
		return { term, posts: entries.map(post => ({ post, tags: tagsByEntry.get(post.data.id) ?? [], bylines: post.data.bylines ?? [] })) };
	});
}
