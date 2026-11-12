export const USERMAVEN_PROXY_PATH = "/s1";
export const USERMAVEN_SCRIPT_UPSTREAM_PATH = "/lib.js";
export const USERMAVEN_SCRIPT_PATH = `${USERMAVEN_PROXY_PATH}${USERMAVEN_SCRIPT_UPSTREAM_PATH}`;

// Usermaven's HTTP Event API sends compact JSON event payloads (~0.5–2 KB per
// pageview/autocapture event or small batched arrays from `lib.js`;
// https://usermaven.com/docs/articles/event-api-18ab9cce, read 2026-11-12).
// Cap buffered event bodies at 64 KiB and return HTTP 413 above it so a single
// request cannot buffer unbounded memory in the Worker.
export const MAX_EVENT_BODY_BYTES = 65_536;

// Subdirectory proxy mapping: `/lib.js` -> `t.usermaven.com`, all other paths ->
// `events.usermaven.com` with the proxy prefix stripped
// (https://usermaven.com/docs/articles/cloudflare-workers-proxy-1efbfffa, read 2026-11-12).
const SCRIPT_ORIGIN = "https://t.usermaven.com";
const EVENTS_ORIGIN = "https://events.usermaven.com";
const SCRIPT_BROWSER_CACHE_CONTROL = "private, max-age=3600";

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
const MAX_DISCARD_BYTES = 16_384;

export interface ProxyCache {
	readonly enabled: boolean;
	set(options: false): void;
}

export interface ProxyUsermavenOptions {
	request: Request;
	cache?: ProxyCache;
	key?: string;
	eventsOrigin?: string;
	fetchImpl?: typeof fetch;
}

type ResolvedTarget =
	| { kind: "not-found" }
	| { kind: "bad-request" }
	| { kind: "ok"; url: URL; isScript: boolean };

type BoundedBodyResult =
	| { kind: "ok"; body: Uint8Array<ArrayBuffer> | undefined }
	| { kind: "too-large" };

export function normalizeUsermavenKey(rawKey?: string): string | undefined {
	const trimmed = rawKey?.trim();
	return trimmed ? trimmed : undefined;
}

export function buildUsermavenProxyUrls(origin: string): {
	trackingHost: string;
	scriptSrc: string;
} {
	const baseOrigin = new URL(origin).origin;
	return {
		trackingHost: `${baseOrigin}${USERMAVEN_PROXY_PATH}`,
		scriptSrc: `${baseOrigin}${USERMAVEN_SCRIPT_PATH}`,
	};
}

function isLoopbackHostname(hostname: string): boolean {
	return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function resolveEventsOrigin(rawEventsOrigin: string | undefined, requestUrl: URL): string {
	const trimmed = rawEventsOrigin?.trim();
	if (!trimmed || !isLoopbackHostname(requestUrl.hostname)) {
		return EVENTS_ORIGIN;
	}
	try {
		const parsed = new URL(trimmed);
		if (
			(parsed.protocol === "http:" || parsed.protocol === "https:") &&
			isLoopbackHostname(parsed.hostname) &&
			parsed.pathname === "/" &&
			parsed.search === "" &&
			parsed.hash === ""
		) {
			return parsed.origin;
		}
	} catch {
		// Ignore malformed local override and keep production events origin.
	}
	return EVENTS_ORIGIN;
}

function buildProxyResponse(
	body: BodyInit | null,
	status: number,
	cacheControl: string,
	extraHeaders?: Record<string, string>,
): Response {
	const headers = new Headers({
		"Cache-Control": cacheControl,
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

function resolveUpstreamTarget(requestUrl: URL, eventsOrigin: string): ResolvedTarget {
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

	const isScript = strippedPath === USERMAVEN_SCRIPT_UPSTREAM_PATH;
	const targetOrigin = isScript ? SCRIPT_ORIGIN : eventsOrigin;
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

async function readBoundedRequestBody(
	request: Request,
	maxBytes: number,
): Promise<BoundedBodyResult> {
	const contentLengthHeader = request.headers.get("content-length")?.trim();
	if (contentLengthHeader) {
		const contentLength = Number(contentLengthHeader);
		if (Number.isFinite(contentLength) && contentLength > maxBytes) {
			await discardRequestBody(request);
			return { kind: "too-large" };
		}
	}

	if (!request.body) {
		return { kind: "ok", body: undefined };
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel();
				return { kind: "too-large" };
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	if (totalBytes === 0) {
		return { kind: "ok", body: undefined };
	}

	const combined = new Uint8Array(new ArrayBuffer(totalBytes));
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { kind: "ok", body: combined };
}

async function rejectRequest(
	request: Request,
	body: string,
	status: number,
	extraHeaders?: Record<string, string>,
): Promise<Response> {
	await discardRequestBody(request);
	return buildProxyResponse(body, status, "no-store", extraHeaders);
}

export async function proxyUsermavenRequest({
	request,
	cache,
	key,
	eventsOrigin,
	fetchImpl = fetch,
}: ProxyUsermavenOptions): Promise<Response> {
	// Opt out of Astro's route cache (https://docs.emdashcms.com/deployment/route-caching/, read 2026-11-12).
	if (cache?.enabled) {
		cache.set(false);
	}

	const configuredKey = normalizeUsermavenKey(key);
	if (!configuredKey) {
		return rejectRequest(request, "Not found", 404);
	}

	const requestUrl = new URL(request.url);
	const resolvedEventsOrigin = resolveEventsOrigin(eventsOrigin, requestUrl);
	const target = resolveUpstreamTarget(requestUrl, resolvedEventsOrigin);
	if (target.kind === "not-found") {
		return rejectRequest(request, "Not found", 404);
	}
	if (target.kind === "bad-request") {
		return rejectRequest(request, "Bad request", 400);
	}

	const method = request.method.toUpperCase();
	const allowedMethods = target.isScript ? SCRIPT_METHODS : EVENT_METHODS;
	if (!allowedMethods.has(method)) {
		return rejectRequest(request, "Method not allowed", 405, {
			Allow: [...allowedMethods].join(", "),
		});
	}

	let body: Uint8Array<ArrayBuffer> | undefined;
	if (method !== "GET" && method !== "HEAD") {
		const bodyResult = await readBoundedRequestBody(request, MAX_EVENT_BODY_BYTES);
		if (bodyResult.kind === "too-large") {
			return buildProxyResponse("Payload too large", 413, "no-store");
		}
		body = bodyResult.body;
	}

	let upstreamResponse: Response;
	try {
		upstreamResponse = await fetchImpl(target.url, {
			method,
			headers: buildUpstreamHeaders(request.headers),
			body,
		});
	} catch {
		return buildProxyResponse("Bad gateway", 502, "no-store");
	}

	const contentType = upstreamResponse.headers.get("content-type");
	const extraHeaders = contentType ? { "Content-Type": contentType } : undefined;
	const cacheControl =
		target.isScript && upstreamResponse.ok ? SCRIPT_BROWSER_CACHE_CONTROL : "no-store";
	return buildProxyResponse(
		upstreamResponse.body,
		upstreamResponse.status,
		cacheControl,
		extraHeaders,
	);
}
