import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { proxyUsermavenRequest } from "../../utils/usermaven.ts";

const runtimeEnv = env as Cloudflare.Env & { USERMAVEN_EVENTS_ORIGIN?: string };

export const ALL: APIRoute = ({ request, cache }) => {
	return proxyUsermavenRequest({
		request,
		cache,
		key: runtimeEnv.USERMAVEN_KEY,
		eventsOrigin: runtimeEnv.USERMAVEN_EVENTS_ORIGIN,
	});
};
