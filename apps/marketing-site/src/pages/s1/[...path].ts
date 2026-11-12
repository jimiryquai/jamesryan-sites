import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { proxyUsermavenRequest } from "../../utils/usermaven.ts";

export const ALL: APIRoute = ({ request, cache }) => {
	return proxyUsermavenRequest({
		request,
		cache,
		key: env.USERMAVEN_KEY,
	});
};
