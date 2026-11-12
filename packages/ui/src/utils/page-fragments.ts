import type { PageFragmentContribution } from "emdash";

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
		// Arbitrary JavaScript cannot safely be rewritten without parsing it. Reject
		// HTML raw-text transitions (including double-escaped script states) instead.
		if (/<\/script|<!--|<script/i.test(fragment.code)) return "";
		return `<script${attrs}>${fragment.code}</script>`;
	}
	if (!safeScriptSource(fragment.src)) return "";
	return `<script src="${escapeAttribute(fragment.src)}"${fragment.async ? " async" : ""}${fragment.defer ? " defer" : ""}${attrs}></script>`;
}

export function renderPageFragments(fragments: PageFragmentContribution[]): Record<"head" | "body-start" | "body-end", string> {
	const groups: Record<"head" | "body-start" | "body-end", string[]> = { head: [], "body-start": [], "body-end": [] };
	for (const fragment of fragments) {
		if (Object.hasOwn(groups, fragment.placement)) groups[fragment.placement].push(renderFragment(fragment));
	}
	return { head: groups.head.join("\n"), "body-start": groups["body-start"].join("\n"), "body-end": groups["body-end"].join("\n") };
}
