import type { APIRoute } from "astro";
import { getEmDashEntry, getSiteSettings } from "emdash";

export const GET: APIRoute = async ({ params }) => {
	let slug = params.slug || "home";

	// Determine collection and entry ID
	let collection = "pages";
	let entryId = slug;

	if (slug.includes("/")) {
		const parts = slug.split("/");
		const prefix = parts[0];
		entryId = parts.slice(1).join("/");
		if (prefix === "posts") {
			collection = "posts";
		} else if (prefix === "work") {
			collection = "projects";
		} else if (prefix === "pages") {
			collection = "pages";
		}
	} else if (["about", "pricing", "privacy-policy"].includes(slug)) {
		collection = "pages";
		entryId = slug;
	}

	let title = "";
	let contentMarkdown = "";

	try {
		const { entry } = await getEmDashEntry(collection as any, entryId);
		if (!entry) {
			return new Response("Not found", { status: 404 });
		}
		title = entry.data.title || entry.data.quote || "Untitled";
		const body = entry.data.content || [];
		contentMarkdown = portableTextToMarkdown(body);
	} catch (e) {
		return new Response("Not found", { status: 404 });
	}

	const settings = await getSiteSettings();
	const siteTitle = settings?.title || "James Ryan";

	const fullMarkdown = `# ${title}
*Published on ${siteTitle}*

${contentMarkdown}
`;

	return new Response(fullMarkdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

function portableTextToMarkdown(content: any[]): string {
	if (!Array.isArray(content)) return "";

	let markdown = "";

	for (const block of content) {
		if (block._type === "block") {
			const style = block.style || "normal";
			let prefix = "";
			let suffix = "";

			if (style.startsWith("h") && style.length === 2) {
				const level = parseInt(style[1], 10);
				prefix = "#".repeat(level) + " ";
				suffix = "\n";
			}

			let blockText = "";
			if (block.children) {
				for (const child of block.children) {
					let text = child.text || "";
					if (child.marks && Array.isArray(child.marks)) {
						for (const mark of child.marks) {
							if (mark === "strong") {
								text = `**${text}**`;
							} else if (mark === "em") {
								text = `*${text}*`;
							} else if (mark === "code") {
								text = `\`${text}\``;
							} else {
								const linkDef = block.markDefs?.find((def: any) => def._key === mark);
								if (linkDef && linkDef.href) {
									text = `[${text}](${linkDef.href})`;
								}
							}
						}
					}
					blockText += text;
				}
			}

			if (block.listItem) {
				const bullet = block.listItem === "bullet" ? "-" : "1.";
				const indent = "  ".repeat((block.level || 1) - 1);
				markdown += `${indent}${bullet} ${blockText}\n`;
			} else {
				markdown += `${prefix}${blockText}${suffix}\n\n`;
			}
		} else if (block._type === "marketing.hero") {
			markdown += `# ${block.headline || ""}\n\n${block.subheadline || ""}\n\n`;
			if (block.primaryCtaLabel) {
				markdown += `[${block.primaryCtaLabel}](${block.primaryCtaUrl || "#"})\n\n`;
			}
		} else if (block._type === "marketing.features") {
			markdown += `## ${block.headline || "Features"}\n\n${block.subheadline || ""}\n\n`;
			if (block.features && Array.isArray(block.features)) {
				for (const feat of block.features) {
					markdown += `### ${feat.title}\n\n${feat.description}\n\n`;
				}
			}
		} else if (block._type === "marketing.testimonials") {
			markdown += `## ${block.headline || "Testimonials"}\n\n`;
			if (block.testimonials && Array.isArray(block.testimonials)) {
				for (const test of block.testimonials) {
					markdown += `> "${test.quote}"\n> — **${test.author}**, ${test.role || ""} (${test.company || ""})\n\n`;
				}
			}
		} else if (block._type === "marketing.pricing") {
			markdown += `## ${block.headline || "Pricing Plans"}\n\n`;
			if (block.plans && Array.isArray(block.plans)) {
				for (const plan of block.plans) {
					markdown += `### ${plan.name} (${plan.price}${plan.period})\n\n${plan.description || ""}\n\n`;
					if (plan.features) {
						markdown += `${plan.features.split("\n").map((f: string) => `- ${f}`).join("\n")}\n\n`;
					}
				}
			}
		} else if (block._type === "marketing.faq") {
			markdown += `## ${block.headline || "FAQ"}\n\n`;
			if (block.items && Array.isArray(block.items)) {
				for (const item of block.items) {
					markdown += `**Q: ${item.question}**\n\n${item.answer}\n\n`;
				}
			}
		} else if (block._type === "marketing.stats") {
			markdown += `## ${block.headline || ""}\n\n${block.subheadline || ""}\n\n`;
			if (block.stats && Array.isArray(block.stats)) {
				for (const stat of block.stats) {
					markdown += `**${stat.stat}**: ${stat.text}\n\n`;
				}
			}
		} else if (block._type === "marketing.cta") {
			markdown += `## ${block.headline || ""}\n\n${block.subheadline || ""}\n\n`;
			if (block.primaryCtaLabel) {
				markdown += `[${block.primaryCtaLabel}](${block.primaryCtaUrl || "#"})\n\n`;
			}
		}
	}

	return markdown;
}
