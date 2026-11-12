import type { APIRoute } from "astro";
import { getPublishedRoute, getMarkdownContentPath, portableTextToMarkdown, discoveryResponse } from "@jamesryan/cms-helpers";
import { getSiteSettingsWithCacheHint } from "emdash";
import { mergeCacheHints } from "emdash-plugin-page-builder/blocks";
import { renderLayoutMarkdown } from "../components/page-builder/layout-markdown";
import { resolvePageLayout } from "../components/page-builder/resolve-page-layout";
import { sources } from "../components/page-builder/sources";

/**
 * The .md twin of a content route: one entry read through the published-route
 * adapter, the page's layout rendered as Markdown (shared-content blocks with
 * the items their sources read), posts and projects their Portable Text.
 * Shared by /[...slug].md and the /posts, /projects and /pages .md endpoints,
 * which pass the full content path in `params.slug`.
 */
export const getContentMarkdown: APIRoute = async ({ params, cache }) => {
	// getPublishedRoute owns the URL mapping, published-only visibility and
	// authorized previews (docs/published-routes.md). `home` is the .md
	// spelling of the root page's `/` path.
	const path = getMarkdownContentPath(params.slug);
	const route = await getPublishedRoute(path, cache, { references: { service: true } });
	if (route?.kind !== "entry") return discoveryResponse(new Response("Not found", { status: 404 }), cache, 60);

	let title = "";
	let contentMarkdown = "";

	if (route.collection === "pages") {
		const { entry } = route;
		title = entry.data.title || "Untitled";
		const pageLayout = resolvePageLayout(entry);
		if (pageLayout) {
			const rendered = await renderLayoutMarkdown(pageLayout.layout, pageLayout.group, sources);
			contentMarkdown = rendered.markdown;
			// Fold what the sources read into the entry's cache hint (Astro merges
			// repeated cache.set calls), as the HTML routes do for their queries.
			if (cache?.enabled) {
				const hint = mergeCacheHints(rendered.cacheHints);
				if (hint.tags?.length || hint.lastModified) cache.set(hint);
			}
		}
	} else {
		const { entry } = route;
		title = entry.data.title || "Untitled";
		contentMarkdown = portableTextToMarkdown(entry.data.content || []);
	}

	const { data: settings, cacheHint: settingsHint } = await getSiteSettingsWithCacheHint();
	if (cache?.enabled) cache.set(settingsHint);
	const siteTitle = settings?.title || "James Ryan";

	const fullMarkdown = `# ${title}
*Published on ${siteTitle}*

${contentMarkdown}
`;

	return discoveryResponse(new Response(fullMarkdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
		},
	}), cache);
};
