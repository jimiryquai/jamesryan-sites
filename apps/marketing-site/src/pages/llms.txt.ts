import type { APIRoute } from "astro";
import { getLlmsTxt } from "@jamesryan/cms-helpers";

export const GET: APIRoute = ({ url, cache }) => getLlmsTxt(url.origin, cache);
