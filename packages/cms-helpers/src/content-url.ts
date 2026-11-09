export function getContentPath(collection: "pages" | "posts" | "projects", slug: string): string {
	if (collection === "pages") {
		if (slug === "home") return "/";
		if (["about", "contact", "pricing", "privacy-policy"].includes(slug)) {
			return `/${slug}`;
		}
	}
	return `/${collection}/${encodeURIComponent(slug)}`;
}
