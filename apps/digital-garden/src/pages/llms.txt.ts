import { discoveryResponse } from "@jamesryan/cms-helpers";
import type { APIRoute } from "astro";
import { getGardenLlmsTxt } from "@jamesryan/cms-helpers";

export const GET: APIRoute = async ({ url, cache }) => discoveryResponse(await getGardenLlmsTxt(url.origin, cache), cache);
