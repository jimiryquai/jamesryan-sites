import { discoveryResponse } from "@jamesryan/cms-helpers";
import type { APIRoute } from "astro";
import { getLlmsTxt } from "@jamesryan/cms-helpers";

export const GET: APIRoute = async ({ url, cache }) => discoveryResponse(await getLlmsTxt(url.origin, cache), cache);
