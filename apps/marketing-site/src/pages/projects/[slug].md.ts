import type { APIRoute } from "astro";
import { getContentMarkdown } from "../../utils/content-markdown";

/** The .md twin of /projects/[slug]: hand the shared handler the full content path. */
export const GET: APIRoute = (context) =>
	getContentMarkdown({ ...context, params: { slug: `projects/${context.params.slug}` } });
