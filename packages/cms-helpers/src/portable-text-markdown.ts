/**
 * Portable Text as plain Markdown for agent-facing `.md` routes.
 * Code blocks, images and blockquotes are part of the text; unknown types
 * are skipped. Links and images keep only http(s), mailto, tel, fragments,
 * site paths, and relative asset paths.
 */

type PortableNode = Record<string, unknown>;

function asRecord(value: unknown): PortableNode | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as PortableNode)
		: undefined;
}

function textValue(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** A URL an agent-facing document may follow. */
export function isSafeMarkdownUrl(url: string): boolean {
	if (/[\u0000-\u001F\u007F]/.test(url)) return false;
	const trimmed = url.trim();
	if (!trimmed || trimmed.startsWith("//")) return false;
	if (trimmed.startsWith("#")) return true;
	if (trimmed.startsWith("/")) return true;
	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
	if (!scheme) return true;
	return ["http", "https", "mailto", "tel"].includes(scheme[1].toLowerCase());
}

function formatDestination(url: string): string {
	if (/[\s()]/.test(url)) return `<${url.replaceAll(">", "%3E")}>`;
	return url;
}

function escapeAlt(value: string): string {
	return value.replace(/\r\n?/g, "\n").replace(/\n+/g, " ").replace(/[\\[\]]/g, "\\$&");
}

function imageAlt(block: PortableNode): string {
	const direct = textValue(block.alt);
	if (direct) return escapeAlt(direct);
	const asset = asRecord(block.asset);
	const assetAlt = asset ? textValue(asset.alt) : undefined;
	if (assetAlt) return escapeAlt(assetAlt);
	const media = asset ? asRecord(asset.$media) : undefined;
	return escapeAlt((media && textValue(media.alt)) || "");
}

function mediaFileUrl(id: string): string {
	return `/_emdash/api/media/file/${encodeURIComponent(id)}`;
}

function imageUrl(block: PortableNode): string | undefined {
	const asset = typeof block.asset === "string" ? undefined : asRecord(block.asset);
	const meta = asset ? asRecord(asset.meta) : undefined;
	const media = asset ? asRecord(asset.$media) : undefined;
	const storageKey = meta ? textValue(meta.storageKey) : undefined;
	const ref = asset ? textValue(asset._ref) ?? textValue(asset.id) : undefined;
	const candidates = [
		textValue(block.url),
		textValue(block.src),
		textValue(block.value),
		typeof block.asset === "string" ? textValue(block.asset) : undefined,
		asset ? textValue(asset.url) : undefined,
		asset ? textValue(asset.src) : undefined,
		asset ? textValue(asset.previewUrl) : undefined,
		storageKey ? mediaFileUrl(storageKey) : undefined,
		ref ? mediaFileUrl(ref) : undefined,
		media ? textValue(media.url) ?? textValue(media.src) ?? textValue(media.file) : undefined,
	];
	for (const candidate of candidates) {
		if (!candidate) continue;
		return isSafeMarkdownUrl(candidate) ? candidate : undefined;
	}
	return undefined;
}

function fenceLanguage(language: unknown): string {
	if (typeof language !== "string") return "";
	return language.trim().split(/\s+/)[0]?.replace(/[\u0000-\u001F\u007F`]/g, "") ?? "";
}

function backtickFence(code: string): string {
	const runs = code.match(/`+/g) ?? [];
	const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
	return "`".repeat(Math.max(3, longest + 1));
}

function wrapCode(text: string): string {
	if (!text.includes("`")) return `\`${text}\``;
	const fence = backtickFence(text);
	return `${fence} ${text} ${fence}`;
}

function markedSpans(block: PortableNode): string {
	const children = block.children;
	if (!Array.isArray(children)) return "";
	let blockText = "";
	for (const child of children) {
		const span = asRecord(child);
		if (!span) continue;
		let text = typeof span.text === "string" ? span.text : "";
		const marks = Array.isArray(span.marks) ? span.marks : [];
		if (marks.includes("code")) text = wrapCode(text);
		if (marks.includes("em")) text = `*${text}*`;
		if (marks.includes("strong")) text = `**${text}**`;
		for (const mark of marks) {
			if (typeof mark !== "string" || mark === "strong" || mark === "em" || mark === "code") continue;
			const defs = Array.isArray(block.markDefs) ? block.markDefs : [];
			const linkDef = defs
				.map(asRecord)
				.find((def) => def?._key === mark && typeof def.href === "string");
			if (linkDef && typeof linkDef.href === "string" && isSafeMarkdownUrl(linkDef.href)) {
				text = `[${text}](${formatDestination(linkDef.href)})`;
			}
		}
		blockText += text;
	}
	return blockText;
}

export function portableTextToMarkdown(content: unknown): string {
	if (!Array.isArray(content)) return "";

	let markdown = "";
	let afterList = false;
	const separateFromList = () => {
		if (!afterList) return;
		markdown += "\n";
		afterList = false;
	};

	for (const item of content) {
		const block = asRecord(item);
		if (!block) continue;

		if (block._type === "code-block-pro" || block._type === "code") {
			separateFromList();
			const language = fenceLanguage(block.language);
			const code = typeof block.code === "string" ? block.code : "";
			const fence = backtickFence(code);
			const body = code.endsWith("\n") ? code : `${code}\n`;
			markdown += `${fence}${language}\n${body}${fence}\n\n`;
			continue;
		}

		if (block._type === "image") {
			const url = imageUrl(block);
			if (!url) continue;
			separateFromList();
			markdown += `![${imageAlt(block)}](${formatDestination(url)})\n\n`;
			continue;
		}

		if (block._type !== "block") continue;

		const style = typeof block.style === "string" ? block.style : "normal";
		let prefix = "";
		const heading = /^h([1-6])$/.exec(style);
		if (heading) prefix = `${"#".repeat(Number(heading[1]))} `;

		const blockText = markedSpans(block);
		if (block.listItem) {
			const bullet = block.listItem === "bullet" ? "-" : "1.";
			const level = typeof block.level === "number" ? block.level : 1;
			const indent = "  ".repeat(Math.max(level, 1) - 1);
			markdown += `${indent}${bullet} ${blockText}\n`;
			afterList = true;
		} else if (style === "blockquote") {
			separateFromList();
			markdown += `${blockText.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
		} else {
			separateFromList();
			markdown += `${prefix}${blockText}\n\n`;
		}
	}

	return markdown;
}
