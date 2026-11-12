import type { APIRoute } from "astro";
import { getGardenLlmsTxt } from "@jamesryan/cms-helpers";

export const GET: APIRoute = ({ url, cache }) => getGardenLlmsTxt(url.origin, cache);
