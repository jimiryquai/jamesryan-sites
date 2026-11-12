import { getContentPath } from "@jamesryan/cms-helpers";

const CONTENT_COLLECTIONS = new Set(["pages", "posts", "projects"]);

/** The public HTML path of a seeded entry. Pages, posts and projects use
 * `getContentPath`; other collections keep their collection prefix. */
export function publishedEntryPath(collection, slug) {
	if (CONTENT_COLLECTIONS.has(collection)) return getContentPath(collection, slug);
	return `/${collection}/${encodeURIComponent(slug)}`;
}

/** The `.md` path of a page. `home` is the markdown spelling of `/`. */
export function pageMarkdownPath(slug) {
	if (slug === "home") return "/home.md";
	return `${getContentPath("pages", slug)}.md`;
}
