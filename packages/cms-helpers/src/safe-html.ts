/** CMS project links must name an absolute web destination. */
export function toSafeExternalHttpUrl(value: unknown): string | null {
	if (typeof value !== "string" || /[\x00-\x1f\x7f]/.test(value)) return null;
	try {
		const parsed = new URL(value.trim());
		return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
	} catch {
		return null;
	}
}

function escapeHtmlAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const documentTags = new Set("p h1 h2 h3 h4 h5 h6 ul ol li strong b em i code pre blockquote br hr a".split(" "));
const nestedContainers = new Set("svg math object template".split(" "));
const discardedContainers = new Set([...nestedContainers, ..."script style iframe textarea xmp plaintext noscript title noembed noframes".split(" ")]);

function safeDocumentHref(raw: string): string | null {
	// Decode URL-relevant entities before checking. Unknown entities fail closed.
	let valid = true;
	const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", colon: ":", Tab: "\t", NewLine: "\n" };
	const decoded = raw.replace(/&(#x[0-9a-f]+;?|#\d+;?|[a-z][a-z0-9]*;?)/gi, (_, entity: string) => {
		if (entity.startsWith("#")) {
			const hex = /^#x/i.test(entity);
			const point = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
			if (point <= 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) { valid = false; return ""; }
			return String.fromCodePoint(point);
		}
		const value = named[entity.replace(/;$/, "")];
		if (value === undefined) valid = false;
		return value ?? "";
	});
	if (!valid || /[\x00-\x1f\x7f\\]/.test(decoded)) return null;
	const href = decoded.trim();
	if (href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//"))) return href;
	try {
		return ["http:", "https:", "mailto:", "tel:"].includes(new URL(href).protocol) ? href : null;
	} catch { return null; }
}

function scanTag(content: string, start: number): { end: number; selfClosing: boolean } {
	let state: "before-name" | "name" | "after-name" | "before-value" | "unquoted" | "quoted" | "self-closing" = "before-name";
	let quote = "";
	for (let index = start; index < content.length; index++) {
		const character = content[index];
		if (state === "quoted") {
			if (character === quote) state = "before-name";
			continue;
		}
		if (character === ">") return { end: index, selfClosing: state === "self-closing" };
		const whitespace = /[\t\n\f\r ]/.test(character);
		if (state === "before-value") {
			if (whitespace) continue;
			if (character === '"' || character === "'") { state = "quoted"; quote = character; }
			else state = "unquoted";
		} else if (state === "unquoted") {
			if (whitespace) state = "before-name";
		} else {
			if (state === "self-closing") state = "before-name";
			if (whitespace) { if (state === "name") state = "after-name"; }
			else if (character === "/") state = "self-closing";
			else if (character === "=" && (state === "name" || state === "after-name")) state = "before-value";
			else state = "name";
		}
	}
	return { end: content.length, selfClosing: false };
}

function isForeignSelfClosing(tag: string, selfClosing: boolean): boolean {
	return selfClosing && (tag === "svg" || tag === "math");
}

function discardContainer(content: string, cursor: number, tag: string): number {
	// Raw-text elements end at their first closing tag. Container subtrees
	// need token boundaries so quoted attributes and comments cannot close them.
	const nested = nestedContainers.has(tag);
	if (!nested) {
		const close = new RegExp(`</${tag}(?=[\\s/>])`, "gi");
		close.lastIndex = cursor;
		const match = close.exec(content);
		return match ? Math.min(scanTag(content, close.lastIndex).end + 1, content.length) : content.length;
	}
	let depth = 1;
	while (cursor < content.length) {
		const next = content.indexOf("<", cursor);
		if (next < 0) break;
		if (content.startsWith("<!--", next)) {
			const end = content.indexOf("-->", next + 4);
			cursor = end < 0 ? content.length : end + 3;
			continue;
		}
		const token = /^<(\/?)([a-z][a-z0-9]*)(?=[\s/>])/i.exec(content.slice(next));
		if (!token) { cursor = next + 1; continue; }
		const { end, selfClosing } = scanTag(content, next + token[0].length);
		cursor = Math.min(end + 1, content.length);
		const name = token[2].toLowerCase();
		if (isForeignSelfClosing(name, selfClosing) && !token[1]) continue;
		if (name === tag) {
			depth += token[1] ? -1 : 1;
			if (depth === 0) return cursor;
		} else if (!token[1] && discardedContainers.has(name) && !nestedContainers.has(name)) {
			cursor = discardContainer(content, cursor, name);
		}
	}
	return content.length;
}

/** Rebuild a deliberately small document vocabulary; never emit input tag markup. */
export function sanitizeDocumentHtml(content: string): string {
	let output = "";
	let cursor = 0;
	while (cursor < content.length) {
		if (content[cursor] !== "<") {
			const next = content.indexOf("<", cursor);
			const end = next < 0 ? content.length : next;
			output += content.slice(cursor, end);
			cursor = end;
			continue;
		}
		if (content.startsWith("<!--", cursor)) {
			const end = content.indexOf("-->", cursor + 4);
			cursor = end < 0 ? content.length : end + 3;
			continue;
		}
		const start = /^<(\/?)([a-z][a-z0-9]*)(?=[\s/>])/i.exec(content.slice(cursor));
		if (!start) { output += "&lt;"; cursor++; continue; }
		const { end, selfClosing: tokenSelfClosing } = scanTag(content, cursor + start[0].length);
		if (end === content.length) break;
		const tag = start[2].toLowerCase();
		const closing = start[1] === "/";
		const attributes = content.slice(cursor + start[0].length, end);
		cursor = end + 1;
		if (discardedContainers.has(tag) && !closing) {
			if (!isForeignSelfClosing(tag, tokenSelfClosing)) cursor = discardContainer(content, cursor, tag);
			continue;
		}
		if (!documentTags.has(tag)) continue;
		if (closing) {
			if (/^\s*$/.test(attributes) && tag !== "br" && tag !== "hr") output += `</${tag}>`;
			continue;
		}
		let href: string | null = null;
		if (tag === "a") {
			const attr = /\s+([^\s=<>"'`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s<>"'`=]+)))?/gy;
			let position = 0;
			let seenHref = false;
			while (position < attributes.length) {
				attr.lastIndex = position;
				const match = attr.exec(attributes);
				if (!match) break;
				position = attr.lastIndex;
				if (match[1].toLowerCase() === "href" && !seenHref) {
					seenHref = true;
					href = safeDocumentHref(match[2] ?? match[3] ?? match[4] ?? "");
				}
			}
		}
		const selfClosing = (tag === "br" || tag === "hr") && /\/\s*$/.test(attributes);
		output += `<${tag}${href === null ? "" : ` href="${escapeHtmlAttribute(href)}"`}${selfClosing ? " /" : ""}>`;
	}
	return output;
}
