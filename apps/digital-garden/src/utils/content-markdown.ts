import type { APIRoute } from "astro";
import { getPublishedRoute, discoveryResponse, portableTextToMarkdown as renderPortableText } from "@jamesryan/cms-helpers";
import { getSiteSettingsWithCacheHint } from "emdash";

export const getContentMarkdown: APIRoute = async ({ params, cache }) => {
	const path = !params.slug || params.slug === "home" ? "/" : `/${params.slug}`;
	const route = await getPublishedRoute(path, cache);
	if (route?.kind !== "entry") return discoveryResponse(new Response("Not found", { status: 404 }), cache, 60);
	const { entry } = route;
	const { data: settings, cacheHint } = await getSiteSettingsWithCacheHint();
	if (cache?.enabled) cache.set(cacheHint);
	const markdown = `# ${entry.data.title || "Untitled"}
*Published on ${settings?.title || "Oatmeal Digital Garden"}*

${portableTextToMarkdown(entry.data.content || [])}
`;
	return discoveryResponse(new Response(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } }), cache);
};

function portableTextToMarkdown(content: any[]): string {
	if (!Array.isArray(content)) return "";

	let markdown = "";

	for (const block of content) {
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
