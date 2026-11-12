import { resolveFragments } from "emdash/page";
import type { PageFragmentContribution, PagePlacement } from "emdash";

function escapeAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scriptAttributes(attributes: Record<string, string> = {}): string {
	return Object.entries(attributes)
		.filter(([name]) => /^[a-zA-Z_:][-a-zA-Z0-9_.:]*$/.test(name) && !/^on/i.test(name) && name.toLowerCase() !== "src")
		.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join("");
}

function safeScriptSource(src: string): boolean {
	if (!src || /[\x00-\x20\x7f\\]/.test(src) || src.startsWith("//")) return false;
	if (/^[a-z][a-z0-9+.-]*:/i.test(src)) {
		try {
			return ["https:", "http:"].includes(new URL(src).protocol);
		} catch { return false; }
	}
	// A colon in the first segment cannot be a relative URL scheme.
	return !src.split("/")[0].includes(":");
}

/** HTML contributions are trusted plugin HTML; script fields cross an escaping boundary. */
export function renderFragment(fragment: PageFragmentContribution): string {
	if (fragment.kind === "html") return fragment.html;
	const attrs = scriptAttributes(fragment.attributes);
	if (fragment.kind === "inline-script") {
		// Unclosed HTML comments can leave HTML's script tokenizer double-escaped.
		let cursor = 0;
		while ((cursor = fragment.code.indexOf("<!--", cursor)) !== -1) {
			const end = fragment.code.indexOf("-->", cursor + 4);
			if (end === -1) return "";
			cursor = end + 3;
		}
		const code = fragment.code.replace(/<\/(script)/gi, "<\\/$1");
		return `<script${attrs}>${code}</script>`;
	}
	if (!safeScriptSource(fragment.src)) return "";
	return `<script src="${escapeAttribute(fragment.src)}"${fragment.async ? " async" : ""}${fragment.defer ? " defer" : ""}${attrs}></script>`;
}

export function renderPageFragments(fragments: PageFragmentContribution[]): Record<PagePlacement, string> {
	const renderPlacement = (placement: PagePlacement) => resolveFragments(fragments, placement)
		.map(renderFragment).filter(Boolean).join("\n");
	return { head: renderPlacement("head"), "body:start": renderPlacement("body:start"), "body:end": renderPlacement("body:end") };
}
