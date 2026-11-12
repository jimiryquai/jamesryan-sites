import type { APIRoute } from "astro";
import { getContentMarkdown } from "../utils/content-markdown";

export const GET: APIRoute = getContentMarkdown;
