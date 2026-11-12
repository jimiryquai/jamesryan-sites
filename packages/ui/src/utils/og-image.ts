export interface OgContent {
	collection: string;
	id: string;
	slug?: string | null;
}

/** Match the canonical OG route prefixes and encode decoded content slugs. */
export function getOgImageUrl(siteUrl: string, content?: OgContent): string {
	if (!content) return `${siteUrl}/og/default.png`;
	const prefix = content.collection === "posts" || content.collection === "projects" ? content.collection : "pages";
	return `${siteUrl}/og/${prefix}/${encodeURIComponent(content.slug || content.id)}.png`;
}
