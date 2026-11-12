import { createSchemaMap } from "@jdevalk/astro-seo-graph";
import { getSchemaCollections, discoveryResponse } from "@jamesryan/cms-helpers";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
	const siteUrl = (context.site?.toString() || context.url.origin).replace(/\/+$/, "");
	const entries = await getSchemaCollections(context.cache);
	const handler = createSchemaMap({ siteUrl, entries });
	return discoveryResponse(await handler(context), context.cache, 300);
};
