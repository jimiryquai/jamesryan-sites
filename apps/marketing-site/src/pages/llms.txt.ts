import type { APIRoute } from "astro";
import { getLlmsTxt, getPublishedRoutes } from "@jamesryan/cms-helpers";

export const GET: APIRoute = async ({ url, cache }) =>
	getLlmsTxt(url.origin, cache, await getPublishedRoutes(cache));
