import { createApiCatalog } from "@jdevalk/astro-seo-graph";
import { getSchemaCollections, discoveryResponse } from "@jamesryan/cms-helpers";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
	const siteUrl = (context.site?.toString() || context.url.origin).replace(/\/+$/, "");
	const schemaEndpoints = await getSchemaCollections(context.cache);
	const handler = createApiCatalog({ siteUrl, schemaEndpoints, schemaMap: { path: "/schemamap.xml" } });
	return discoveryResponse(await handler(context), context.cache, 300);
};
