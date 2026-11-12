/** Public content collections and their discovery section labels. */
export const PUBLIC_COLLECTIONS = {
	pages: "Pages",
	posts: "Posts",
	projects: "Work",
} as const;

export type PublicCollection = keyof typeof PUBLIC_COLLECTIONS;

export const publicCollections = Object.keys(PUBLIC_COLLECTIONS) as PublicCollection[];
