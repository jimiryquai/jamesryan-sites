import type { APIRoute } from "astro";
import { getPublishedRoute } from "@jamesryan/cms-helpers";
import { getRequestContext, getSiteSettings } from "emdash";
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
	const path = params.slug === "home" || !params.slug ? "/" : `/${params.slug}`;
	const route = await getPublishedRoute(path, cache, { references: { service: true } });
	if (route?.kind !== "entry") return new Response("Not found", { status: 404 });

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

	const settings = await getSiteSettings();
	const siteTitle = settings?.title || "James Ryan";

	const fullMarkdown = `# ${title}
*Published on ${siteTitle}*

${contentMarkdown}
`;

	// Edit mode and verified previews may serve drafts; the response is
	// session-specific and must never reach a shared cache (EmDash's middleware
	// already does this for HTML, which a markdown response is not).
	const requestContext = getRequestContext();
	const sessionRender = requestContext?.editMode === true || requestContext?.preview !== undefined;
	if (sessionRender) cache?.set(false);

	return new Response(fullMarkdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": sessionRender ? "private, no-store" : "public, max-age=3600",
		},
	});
};

function portableTextToMarkdown(content: any[]): string {
	if (!Array.isArray(content)) return "";

	let markdown = "";

	for (const block of content) {
		if (block._type === "block") {
			const style = block.style || "normal";
			let prefix = "";
			let suffix = "";

			if (style.startsWith("h") && style.length === 2) {
				const level = parseInt(style[1], 10);
				prefix = "#".repeat(level) + " ";
				suffix = "\n";
			}

			let blockText = "";
			if (block.children) {
				for (const child of block.children) {
					let text = child.text || "";
					if (child.marks && Array.isArray(child.marks)) {
						for (const mark of child.marks) {
							if (mark === "strong") {
								text = `**${text}**`;
							} else if (mark === "em") {
								text = `*${text}*`;
							} else if (mark === "code") {
								text = `\`${text}\``;
							} else {
								const linkDef = block.markDefs?.find((def: any) => def._key === mark);
								if (linkDef && linkDef.href) {
									text = `[${text}](${linkDef.href})`;
								}
							}
						}
					}
					blockText += text;
				}
			}

			if (block.listItem) {
				const bullet = block.listItem === "bullet" ? "-" : "1.";
				const indent = "  ".repeat((block.level || 1) - 1);
				markdown += `${indent}${bullet} ${blockText}\n`;
			} else {
				markdown += `${prefix}${blockText}${suffix}\n\n`;
			}
		}
	}

	return markdown;
}
