/**
 * Portable Text as plain Markdown for agent-facing `.md` routes.
 * Code blocks, images and blockquotes are part of the text; unknown types
 * are skipped.
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

function imageAlt(block: PortableNode): string {
	const direct = textValue(block.alt);
	if (direct) return direct;
	const asset = asRecord(block.asset);
	const assetAlt = asset ? textValue(asset.alt) : undefined;
	if (assetAlt) return assetAlt;
	const media = asset ? asRecord(asset.$media) : undefined;
	return (media && textValue(media.alt)) || "";
}

function imageUrl(block: PortableNode): string | undefined {
	const direct = textValue(block.url) ?? textValue(block.src) ?? textValue(block.value);
	if (direct) return direct;
	if (typeof block.asset === "string") return textValue(block.asset);
	const asset = asRecord(block.asset);
	if (!asset) return undefined;
	const resolved = textValue(asset.url) ?? textValue(asset.src) ?? textValue(asset.previewUrl);
	if (resolved) return resolved;
	const meta = asRecord(asset.meta);
	const storageKey = meta ? textValue(meta.storageKey) : undefined;
	if (storageKey) return `/_emdash/api/media/file/${encodeURIComponent(storageKey)}`;
	const media = asRecord(asset.$media);
	if (!media) return undefined;
	return textValue(media.url) ?? textValue(media.src) ?? textValue(media.file);
}

function markedSpans(block: PortableNode): string {
	const children = block.children;
	if (!Array.isArray(children)) return "";
	let blockText = "";
	for (const child of children) {
		const span = asRecord(child);
		if (!span) continue;
		let text = typeof span.text === "string" ? span.text : "";
		if (Array.isArray(span.marks)) {
			for (const mark of span.marks) {
				if (mark === "strong") text = `**${text}**`;
				else if (mark === "em") text = `*${text}*`;
				else if (mark === "code") text = `\`${text}\``;
				else if (typeof mark === "string") {
					const defs = Array.isArray(block.markDefs) ? block.markDefs : [];
					const linkDef = defs
						.map(asRecord)
						.find((def) => def?._key === mark && typeof def.href === "string");
					if (linkDef && typeof linkDef.href === "string") text = `[${text}](${linkDef.href})`;
				}
			}
		}
		blockText += text;
	}
	return blockText;
}

export function portableTextToMarkdown(content: unknown): string {
	if (!Array.isArray(content)) return "";

	let markdown = "";
	for (const item of content) {
		const block = asRecord(item);
		if (!block) continue;

		if (block._type === "code-block-pro" || block._type === "code") {
			const language = typeof block.language === "string" ? block.language : "";
			const code = typeof block.code === "string" ? block.code : "";
			const body = code.endsWith("\n") ? code : `${code}\n`;
			markdown += `\`\`\`${language}\n${body}\`\`\`\n\n`;
			continue;
		}

		if (block._type === "image") {
			const url = imageUrl(block);
			if (!url) continue;
			markdown += `![${imageAlt(block)}](${url})\n\n`;
			continue;
		}

		if (block._type !== "block") continue;

		const style = typeof block.style === "string" ? block.style : "normal";
		let prefix = "";
		let suffix = "";
		if (style.startsWith("h") && style.length === 2) {
			const level = parseInt(style[1] ?? "", 10);
			if (level >= 1 && level <= 6) {
				prefix = `${"#".repeat(level)} `;
				suffix = "\n";
			}
		}

		const blockText = markedSpans(block);
		if (block.listItem) {
			const bullet = block.listItem === "bullet" ? "-" : "1.";
			const level = typeof block.level === "number" ? block.level : 1;
			const indent = "  ".repeat(Math.max(level, 1) - 1);
			markdown += `${indent}${bullet} ${blockText}\n`;
		} else if (style === "blockquote") {
			markdown += `${blockText.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
		} else {
			markdown += `${prefix}${blockText}${suffix}\n\n`;
		}
	}

	return markdown;
}
