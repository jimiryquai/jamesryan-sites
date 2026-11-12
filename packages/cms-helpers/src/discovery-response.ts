import { getRequestContext } from "emdash";

/** Apply discovery policy to Worker responses, where static _headers do not run. */
export function discoveryResponse(
	response: Response,
	cache?: { set: (hint: false) => void },
	maxAge = 3600,
): Response {
	const context = getRequestContext();
	const sessionRender = context?.editMode === true || context?.preview !== undefined;
	if (sessionRender) cache?.set(false);
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Cache-Control", sessionRender ? "private, no-store" : `public, max-age=${maxAge}`);
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
