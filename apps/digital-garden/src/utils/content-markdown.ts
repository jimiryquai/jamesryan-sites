import { resolveSiteIdentity } from "@jamesryan/cms-helpers";
import type { APIRoute } from "astro";
import { getPublishedRoute, getMarkdownContentPath, discoveryResponse, portableTextToMarkdown as renderPortableText } from "@jamesryan/cms-helpers";
import { getSiteSettingsWithCacheHint } from "emdash";

export const getContentMarkdown: APIRoute = async ({ params, cache }) => {
	const path = getMarkdownContentPath(params.slug);
	const route = await getPublishedRoute(path, cache);
	if (route?.kind !== "entry") return discoveryResponse(new Response("Not found", { status: 404 }), cache, 60);
	const { entry } = route;
	const { data: settings, cacheHint } = await getSiteSettingsWithCacheHint();
	if (cache?.enabled) cache.set(cacheHint);
	const markdown = `# ${entry.data.title || "Untitled"}
*Published on ${resolveSiteIdentity(settings).siteTitle}*

${portableTextToMarkdown(entry.data.content || [])}
`;
	return discoveryResponse(new Response(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } }), cache);
};

function records(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> =>
		item !== null && typeof item === "object" && !Array.isArray(item),
	) : [];
}

function portableTextToMarkdown(content: unknown): string {
	if (!Array.isArray(content)) return "";

	let markdown = "";

	for (const block of records(content)) {
		if (block._type === "block" || block._type === "code" || block._type === "code-block-pro" || block._type === "image") {
			markdown += renderPortableText([block]);
			continue;
		}
		if (block._type === "marketing.hero") {
			markdown += `# ${block.headline || ""}\n\n${block.subheadline || ""}\n\n`;
			if (block.primaryCtaLabel) {
				markdown += `[${block.primaryCtaLabel}](${block.primaryCtaUrl || "#"})\n\n`;
			}
		} else if (block._type === "marketing.features") {
			markdown += `## ${block.headline || "Features"}\n\n${block.subheadline || ""}\n\n`;
			if (block.features && Array.isArray(block.features)) {
				for (const feat of records(block.features)) {
					markdown += `### ${feat.title}\n\n${feat.description}\n\n`;
				}
			}
		} else if (block._type === "marketing.testimonials") {
			markdown += `## ${block.headline || "Testimonials"}\n\n`;
			if (block.testimonials && Array.isArray(block.testimonials)) {
				for (const test of records(block.testimonials)) {
					markdown += `> "${test.quote}"\n> — **${test.author}**, ${test.role || ""} (${test.company || ""})\n\n`;
				}
			}
		} else if (block._type === "marketing.pricing") {
			markdown += `## ${block.headline || "Pricing Plans"}\n\n`;
			if (block.plans && Array.isArray(block.plans)) {
				for (const plan of records(block.plans)) {
					markdown += `### ${plan.name} (${plan.price}${plan.period})\n\n${plan.description || ""}\n\n`;
					if (typeof plan.features === "string") {
						markdown += `${plan.features.split("\n").map((f: string) => `- ${f}`).join("\n")}\n\n`;
					}
				}
			}
		} else if (block._type === "marketing.faq") {
			markdown += `## ${block.headline || "FAQ"}\n\n`;
			if (block.items && Array.isArray(block.items)) {
				for (const item of records(block.items)) {
					markdown += `**Q: ${item.question}**\n\n${item.answer}\n\n`;
				}
			}
		} else if (block._type === "marketing.stats") {
			markdown += `## ${block.headline || ""}\n\n${block.subheadline || ""}\n\n`;
			if (block.stats && Array.isArray(block.stats)) {
				for (const stat of records(block.stats)) {
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
