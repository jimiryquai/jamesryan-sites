import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import { USERMAVEN_PROXY_PATH, proxyUsermavenRequest } from "../src/utils/usermaven.ts";

function createCache(enabled = false) {
	const calls = [];
	return {
		enabled,
		calls,
		set(value) {
			if (!enabled) {
				throw new Error("cache.set must not be called when cache is disabled");
			}
			calls.push(value);
		},
	};
}

function rejectUpstreamFetch() {
	throw new Error("Upstream fetch must not be called");
}

test("proxy returns 404 without contacting upstream when USERMAVEN_KEY is unset or blank", async () => {
	for (const key of [undefined, "", "   "]) {
		const enabledCache = createCache(true);
		const getRes = await proxyUsermavenRequest({
			request: new Request("https://jamesryan.dev/s1/lib.js"),
			cache: enabledCache,
			key,
			fetchImpl: rejectUpstreamFetch,
		});
		assert.equal(getRes.status, 404);
		assert.equal(getRes.headers.get("cache-control"), "no-store");
		assert.deepEqual(enabledCache.calls, [false]);

		const disabledCache = createCache(false);
		const postRes = await proxyUsermavenRequest({
			request: new Request("https://jamesryan.dev/s1/api/v1/event?token=UMNstP14wS", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ event_type: "pageview" }),
			}),
			cache: disabledCache,
			key,
			fetchImpl: rejectUpstreamFetch,
		});
		assert.equal(postRes.status, 404);
		assert.equal(postRes.headers.get("cache-control"), "no-store");
	}
});

test("proxy maps /s1/lib.js to t.usermaven.com and strips prefix for event paths to events.usermaven.com", async () => {
	const upstreamCalls = [];
	async function fakeUpstream(input, init = {}) {
		const url = new URL(typeof input === "string" ? input : input.toString());
		const headers = new Headers(init.headers);
		const bodyText = init.body ? Buffer.from(init.body).toString("utf8") : "";
		upstreamCalls.push({
			url: url.toString(),
			method: init.method ?? "GET",
			headers: Object.fromEntries(headers.entries()),
			body: bodyText,
		});
		if (url.origin === "https://t.usermaven.com" && url.pathname === "/lib.js") {
			return new Response("window.usermaven=function(){};", {
				status: 200,
				headers: {
					"Content-Type": "application/javascript",
					"Access-Control-Allow-Origin": "*",
					"Set-Cookie": "upstream_tracker=1; Path=/",
					"Content-Encoding": "br",
					"Content-Length": "999",
				},
			});
		}
		return new Response(JSON.stringify({ status: 1 }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Set-Cookie": "upstream_event=1; Path=/",
			},
		});
	}

	const scriptCache = createCache(true);
	const scriptRes = await proxyUsermavenRequest({
		request: new Request("https://jamesryan.dev/s1/lib.js?v=1"),
		cache: scriptCache,
		key: "UMNstP14wS",
		fetchImpl: fakeUpstream,
	});
	assert.equal(scriptRes.status, 200);
	assert.equal(await scriptRes.text(), "window.usermaven=function(){};");
	assert.equal(scriptRes.headers.get("content-type"), "application/javascript");
	assert.equal(scriptRes.headers.get("cache-control"), "no-store");
	assert.equal(scriptRes.headers.get("access-control-allow-origin"), null);
	assert.equal(scriptRes.headers.get("set-cookie"), null);
	assert.equal(scriptRes.headers.get("content-encoding"), null);
	assert.deepEqual(scriptCache.calls, [false]);
	assert.equal(upstreamCalls[0].url, "https://t.usermaven.com/lib.js?v=1");
	assert.equal(upstreamCalls[0].method, "GET");

	const payload = JSON.stringify([{ event_type: "pageview", api_key: "UMNstP14wS" }]);
	const eventCache = createCache(true);
	const eventRes = await proxyUsermavenRequest({
		request: new Request(
			"https://jamesryan.dev/s1/api.k9x2m1?p_a7b3=UMNstP14wS&cookie_policy=strict&ip_policy=strict",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: payload,
			},
		),
		cache: eventCache,
		key: "UMNstP14wS",
		fetchImpl: fakeUpstream,
	});
	assert.equal(eventRes.status, 200);
	assert.equal(await eventRes.text(), '{"status":1}');
	assert.equal(eventRes.headers.get("content-type"), "application/json");
	assert.equal(eventRes.headers.get("cache-control"), "no-store");
	assert.equal(eventRes.headers.get("access-control-allow-origin"), null);
	assert.equal(eventRes.headers.get("set-cookie"), null);
	assert.deepEqual(eventCache.calls, [false]);
	assert.equal(
		upstreamCalls[1].url,
		"https://events.usermaven.com/api.k9x2m1?p_a7b3=UMNstP14wS&cookie_policy=strict&ip_policy=strict",
	);
	assert.equal(upstreamCalls[1].method, "POST");
	assert.equal(upstreamCalls[1].body, payload);

	const standardEventRes = await proxyUsermavenRequest({
		request: new Request("https://jamesryan.dev/s1/api/v1/event?token=UMNstP14wS", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: payload,
		}),
		key: "UMNstP14wS",
		fetchImpl: fakeUpstream,
	});
	assert.equal(standardEventRes.status, 200);
	assert.equal(upstreamCalls[2].url, "https://events.usermaven.com/api/v1/event?token=UMNstP14wS");
});

test("proxy forwards only allowlisted headers, strips EmDash session cookies and Authorization, and maps CF-Connecting-IP to X-Forwarded-For", async () => {
	const upstreamHeadersReceived = [];
	async function fakeUpstream(_input, init = {}) {
		const headers = new Headers(init.headers);
		upstreamHeadersReceived.push(Object.fromEntries(headers.entries()));
		return new Response(JSON.stringify({ status: 1 }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	const eventRes = await proxyUsermavenRequest({
		request: new Request("https://jamesryan.dev/s1/api/v1/event?token=UMNstP14wS", {
			method: "POST",
			headers: {
				Cookie: "emdash_session=admin-secret-session-ulid; theme=dark",
				Authorization: "Bearer emdash_pat_secret_token",
				"Proxy-Authorization": "Basic c2VjcmV0",
				"CF-Connecting-IP": "203.0.113.42",
				"CF-Ray": "89abcdef01234567-LHR",
				"X-Forwarded-For": "198.51.100.99",
				"X-Real-IP": "198.51.100.98",
				Origin: "https://jamesryan.dev",
				"X-Admin-Debug": "do-not-forward",
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
				Referer: "https://jamesryan.dev/posts/example",
				"Content-Type": "application/json",
				Accept: "application/json, text/plain, */*",
				"Accept-Language": "en-GB,en;q=0.9",
			},
			body: JSON.stringify({ event_type: "pageview" }),
		}),
		key: "UMNstP14wS",
		fetchImpl: fakeUpstream,
	});
	assert.equal(eventRes.status, 200);
	assert.deepEqual(upstreamHeadersReceived[0], {
		accept: "application/json, text/plain, */*",
		"accept-language": "en-GB,en;q=0.9",
		"content-type": "application/json",
		referer: "https://jamesryan.dev/posts/example",
		"user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
		"x-forwarded-for": "203.0.113.42",
	});

	const scriptRes = await proxyUsermavenRequest({
		request: new Request("https://jamesryan.dev/s1/lib.js", {
			headers: {
				Cookie: "emdash_session=admin-secret-session-ulid",
				Authorization: "Bearer emdash_pat_secret_token",
				"X-Forwarded-For": "198.51.100.77",
				"User-Agent": "Mozilla/5.0 TestBrowser",
				Accept: "*/*",
			},
		}),
		key: "UMNstP14wS",
		fetchImpl: fakeUpstream,
	});
	assert.equal(scriptRes.status, 200);
	assert.deepEqual(upstreamHeadersReceived[1], {
		accept: "*/*",
		"user-agent": "Mozilla/5.0 TestBrowser",
	});
});

test("proxy rejects path confusion and disallowed HTTP methods, handles upstream errors without leaking details, and matches the Astro endpoint path", async () => {
	await access(new URL(`../src/pages${USERMAVEN_PROXY_PATH}/[...path].ts`, import.meta.url));

	for (const badUrl of [
		"https://jamesryan.dev/s1//evil.example/pwn",
		"https://jamesryan.dev/s1/%2f%2fevil.example/pwn",
		"https://jamesryan.dev/s1/%252e%252e/admin",
		"https://jamesryan.dev/s1/%E0%A4%A",
	]) {
		const res = await proxyUsermavenRequest({
			request: new Request(badUrl),
			key: "UMNstP14wS",
			fetchImpl: rejectUpstreamFetch,
		});
		assert.equal(res.status, 400, `${badUrl} should return 400`);
		assert.equal(res.headers.get("cache-control"), "no-store");
	}

	const outsidePrefixRes = await proxyUsermavenRequest({
		request: new Request("https://jamesryan.dev/s1/%2e%2e/_emdash/admin"),
		key: "UMNstP14wS",
		fetchImpl: rejectUpstreamFetch,
	});
	assert.equal(outsidePrefixRes.status, 404);

	for (const [method, url] of [
		["POST", "https://jamesryan.dev/s1/lib.js"],
		["DELETE", "https://jamesryan.dev/s1/api/v1/event"],
		["PUT", "https://jamesryan.dev/s1/api/v1/event"],
		["OPTIONS", "https://jamesryan.dev/s1/api/v1/event"],
	]) {
		const res = await proxyUsermavenRequest({
			request: new Request(url, { method }),
			key: "UMNstP14wS",
			fetchImpl: rejectUpstreamFetch,
		});
		assert.equal(res.status, 405, `${method} ${url} should return 405`);
		assert.equal(res.headers.get("cache-control"), "no-store");
	}

	const gatewayErrorRes = await proxyUsermavenRequest({
		request: new Request("https://jamesryan.dev/s1/lib.js"),
		key: "UMNstP14wS",
		fetchImpl: async () => {
			throw new Error("internal socket details 10.0.0.5");
		},
	});
	assert.equal(gatewayErrorRes.status, 502);
	assert.equal(gatewayErrorRes.headers.get("cache-control"), "no-store");
	assert.equal(await gatewayErrorRes.text(), "Bad gateway");

	let cancelledOversized = false;
	const oversizedBody = new ReadableStream({
		pull(controller) {
			controller.enqueue(new Uint8Array(8_192));
		},
		cancel() {
			cancelledOversized = true;
		},
	});
	const oversizedRes = await proxyUsermavenRequest({
		request: new Request("https://jamesryan.dev/s1/api/v1/event", {
			method: "POST",
			body: oversizedBody,
			duplex: "half",
		}),
		key: undefined,
		fetchImpl: rejectUpstreamFetch,
	});
	assert.equal(oversizedRes.status, 404);
	assert.equal(cancelledOversized, true);
});

