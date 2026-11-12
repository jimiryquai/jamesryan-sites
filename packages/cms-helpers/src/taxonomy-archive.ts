import { decodeSlug, getTaxonomyTermsWithCacheHint, getEmDashCollection, getTermsForEntries, type PortableTextBlock, type ContentBylineCredit, type MediaValue, type TaxonomyTerm } from "emdash";
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

function findTerm(terms: TaxonomyTerm[], slug: string): TaxonomyTerm | undefined {
	for (const term of terms) {
		if (term.slug === slug) return term;
		const child = term.children && findTerm(term.children, slug);
		if (child) return child;
	}
}

/** Resolve a taxonomy archive against published revisions, including during preview. */
export async function getTaxonomyArchive(taxonomy: "category" | "tag", rawSlug?: string, cache?: RequestCache) {
	const slug = decodeSlug(rawSlug);
	if (!slug) return null;
	const termsResult = await getTaxonomyTermsWithCacheHint(taxonomy, { includeCounts: false });
	if (cache?.enabled) cache.set(termsResult.cacheHint);
	const term = findTerm(termsResult.data, slug);
	if (!term) return null;

	return runPublishedOnly(async () => {
		const { entries, cacheHint, error } = await getEmDashCollection<"posts", ArchivePost>("posts", {
			status: "published",
			where: { [taxonomy]: term.slug },
			orderBy: { published_at: "desc" },
		});
		if (error) throw error;
		if (cache?.enabled) cache.set(cacheHint);
		if (taxonomy !== "tag" && entries.length > 0) {
			const tagsResult = await getTaxonomyTermsWithCacheHint("tag", { includeCounts: false });
			if (cache?.enabled) cache.set(tagsResult.cacheHint);
		}
		const tagsByEntry = await getTermsForEntries("posts", entries.map(post => post.data.id), "tag");
		return { term, posts: entries.map(post => ({ post, tags: tagsByEntry.get(post.data.id) ?? [], bylines: post.data.bylines ?? [] })) };
	});
}
