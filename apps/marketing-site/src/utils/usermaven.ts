export const USERMAVEN_PROXY_PATH = "/s1";

const SCRIPT_ORIGIN = "https://t.usermaven.com";
const EVENTS_ORIGIN = "https://events.usermaven.com";

// Usermaven's HTTP event API enriches geolocation, device, and referrer data
// from `x-forwarded-for`, `user-agent`, and `referer`
// (https://usermaven.com/docs/articles/event-api-18ab9cce, read 2026-11-12).
// Never copy `cookie`, `authorization`, or client-supplied `x-forwarded-for`.
const FORWARDED_REQUEST_HEADERS = [
	"accept",
	"accept-language",
	"content-type",
	"referer",
	"user-agent",
] as const;

const SCRIPT_METHODS = new Set(["GET", "HEAD"]);
const EVENT_METHODS = new Set(["GET", "HEAD", "POST"]);

export interface ProxyCache {
	readonly enabled: boolean;
	set(options: false): void;
}

export interface ProxyUsermavenOptions {
	request: Request;
	cache?: ProxyCache;
	key?: string;
	fetchImpl?: typeof fetch;
}

type ResolvedTarget =
	| { kind: "not-found" }
	| { kind: "bad-request" }
	| { kind: "ok"; url: URL; isScript: boolean };

export function normalizeUsermavenKey(rawKey?: string): string | undefined {
	const trimmed = rawKey?.trim();
	return trimmed ? trimmed : undefined;
}

function noStoreResponse(
	body: BodyInit | null,
	status: number,
	extraHeaders?: Record<string, string>,
): Response {
	const headers = new Headers({
		"Cache-Control": "no-store",
		...extraHeaders,
	});
	return new Response(body, {
		status,
		headers,
	});
}

function hasUnsafePath(pathname: string): boolean {
	const lower = pathname.toLowerCase();
	if (
		pathname.startsWith("//") ||
		pathname.includes("\\") ||
		lower.includes("%2e") ||
		lower.includes("%2f") ||
		lower.includes("%5c")
	) {
		return true;
	}
	return pathname.split("/").includes("..");
}

function resolveUpstreamTarget(requestUrl: URL): ResolvedTarget {
	if (
		requestUrl.pathname !== USERMAVEN_PROXY_PATH &&
		!requestUrl.pathname.startsWith(`${USERMAVEN_PROXY_PATH}/`)
	) {
		return { kind: "not-found" };
	}

	const rawSuffix = requestUrl.pathname.slice(USERMAVEN_PROXY_PATH.length);
	const strippedPath = rawSuffix === "" ? "/" : rawSuffix;
	let decodedPath: string;
	try {
		decodedPath = decodeURIComponent(strippedPath);
	} catch {
		return { kind: "bad-request" };
	}

	if (hasUnsafePath(strippedPath) || hasUnsafePath(decodedPath)) {
		return { kind: "bad-request" };
	}

	const isScript = strippedPath === "/lib.js";
	const targetOrigin = isScript ? SCRIPT_ORIGIN : EVENTS_ORIGIN;
	const upstreamUrl = new URL(targetOrigin);
	upstreamUrl.pathname = strippedPath;
	upstreamUrl.search = requestUrl.search;
	if (upstreamUrl.origin !== targetOrigin || upstreamUrl.pathname.startsWith("//")) {
		return { kind: "bad-request" };
	}

	return {
		kind: "ok",
		url: upstreamUrl,
		isScript,
	};
}

function buildUpstreamHeaders(incomingHeaders: Headers): Headers {
	const headers = new Headers();
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = incomingHeaders.get(name);
		if (value !== null) {
			headers.set(name, value);
		}
	}

	const connectingIp = incomingHeaders.get("cf-connecting-ip")?.trim();
	if (connectingIp) {
		headers.set("x-forwarded-for", connectingIp);
	}

	return headers;
}

const MAX_DISCARD_BYTES = 16_384;

async function discardRequestBody(request: Request): Promise<void> {
	if (!request.body) {
		return;
	}
	const reader = request.body.getReader();
	let totalBytes = 0;
	try {
		while (totalBytes <= MAX_DISCARD_BYTES) {
			const { done, value } = await reader.read();
			if (done) {
				return;
			}
			totalBytes += value.byteLength;
		}
		await reader.cancel();
	} catch {
		// Ignore stream read/cancel errors on rejected requests.
	} finally {
		reader.releaseLock();
	}
}

export async function proxyUsermavenRequest({
	request,
	cache,
	key,
	fetchImpl = fetch,
}: ProxyUsermavenOptions): Promise<Response> {
	if (cache?.enabled) {
		cache.set(false);
	}

	const configuredKey = normalizeUsermavenKey(key);
	if (!configuredKey) {
		await discardRequestBody(request);
		return noStoreResponse("Not found", 404);
	}

	const target = resolveUpstreamTarget(new URL(request.url));
	if (target.kind === "not-found") {
		await discardRequestBody(request);
		return noStoreResponse("Not found", 404);
	}
	if (target.kind === "bad-request") {
		await discardRequestBody(request);
		return noStoreResponse("Bad request", 400);
	}

	const method = request.method.toUpperCase();
	const allowedMethods = target.isScript ? SCRIPT_METHODS : EVENT_METHODS;
	if (!allowedMethods.has(method)) {
		await discardRequestBody(request);
		const allowHeader = target.isScript ? "GET, HEAD" : "GET, HEAD, POST";
		return noStoreResponse("Method not allowed", 405, { Allow: allowHeader });
	}

	const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
	let upstreamResponse: Response;
	try {
		upstreamResponse = await fetchImpl(target.url, {
			method,
			headers: buildUpstreamHeaders(request.headers),
			body,
		});
	} catch {
		return noStoreResponse("Bad gateway", 502);
	}

	const contentType = upstreamResponse.headers.get("content-type");
	const extraHeaders = contentType ? { "Content-Type": contentType } : undefined;
	return noStoreResponse(upstreamResponse.body, upstreamResponse.status, extraHeaders);
}
