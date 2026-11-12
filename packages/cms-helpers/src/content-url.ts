import { publicCollections, type PublicCollection } from "./public-collections.ts";

const topLevelPages = ["about", "contact", "pricing", "privacy-policy"];

export function getContentPath(collection: PublicCollection, slug: string): string {
	if (collection === "pages") {
		if (slug === "home") return "/";
		if (topLevelPages.includes(slug)) return `/${slug}`;
	}
	return `/${collection}/${encodeURIComponent(slug)}`;
}

/** Inverse of getContentPath; rejects aliases and malformed encodings. */
export function resolveContentPath(path: string): { collection: PublicCollection; slug: string } | null {
	if (path === "/") return { collection: "pages", slug: "home" };
	if (topLevelPages.some((slug) => path === `/${slug}`)) {
		return { collection: "pages", slug: path.slice(1) };
	}
	const [, prefix, encodedSlug, extra] = path.split("/");
	const collection = publicCollections.find((collection) => collection === prefix);
	if (!collection || !encodedSlug || extra !== undefined) return null;
	try {
		const slug = decodeURIComponent(encodedSlug);
		return getContentPath(collection, slug) === path ? { collection, slug } : null;
	} catch {
		return null;
	}
}
