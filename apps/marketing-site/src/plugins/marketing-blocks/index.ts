/**
 * Marketing blocks plugin (inline, template-local).
 *
 * Registers the five marketing block types so editors can insert and edit them
 * in the admin's Portable Text editor. Block Kit `fields` describe the form
 * shown when inserting or editing a block.
 *
 * Constraints worth knowing:
 *
 * - Block Kit has no "object group" element, so nested object shapes (e.g. a
 *   CTA's { label, url }) are flattened to sibling fields like ctaLabel and
 *   ctaUrl. The site-side renderer reads the flat keys.
 * - Repeater sub-fields are scalar only: text_input, number_input, select,
 *   toggle. Nested repeaters are not allowed -- list-of-strings becomes a
 *   single multiline text field, split on newline at render time (see
 *   Pricing.astro for the pattern).
 * - There is no media picker element in the editor's plugin-block modal yet,
 *   so image fields (avatars, hero images) are URL strings entered by hand.
 *
 * These template blocks render through MarketingBlocks.astro. Native plugins
 * such as Code Block Pro register componentsEntry for automatic Portable Text rendering.
 */

import { definePlugin } from "emdash";
import type { PluginDefinition } from "emdash";

const ICON_OPTIONS = [
	{ label: "Lightning", value: "zap" },
	{ label: "Shield", value: "shield" },
	{ label: "Users", value: "users" },
	{ label: "Chart", value: "chart" },
	{ label: "Code", value: "code" },
	{ label: "Globe", value: "globe" },
	{ label: "Heart", value: "heart" },
	{ label: "Star", value: "star" },
	{ label: "Check", value: "check" },
	{ label: "Lock", value: "lock" },
	{ label: "Clock", value: "clock" },
	{ label: "Cloud", value: "cloud" },
];

const definition: PluginDefinition = {
	id: "marketing-blocks",
	version: "0.1.0",
	capabilities: ["content:read"],

	routes: {
		services: {
			handler: async (ctx) => {
				if (!ctx.content) {
					return { items: [] };
				}
				const result = await ctx.content.list("services", { limit: 100 });
				const items = result.items || (result as any).entries || [];
				return {
					items: items.map((entry: any) => ({
						id: entry.id,
						name: String(entry.data?.title || entry.id),
						value: entry.id,
						label: String(entry.data?.title || entry.id),
					})),
				};
			},
		},
	},

	admin: {
		portableTextBlocks: [
			{
				type: "marketing.hero",
				label: "Hero",
				category: "Sections",
				description: "Big headline section with optional CTAs or pricing plans",
				fields: [
					{
						type: "select",
						action_id: "variation",
						label: "Variation",
						options: [
							{ label: "Left Aligned with Demo", value: "left-aligned-with-demo" },
							{ label: "Left Aligned with Photo", value: "left-aligned-with-photo" },
							{ label: "Pricing Hero Multi Tier", value: "pricing-hero-multi-tier" },
						],
					},
					{ type: "text_input", action_id: "eyebrowText", label: "Eyebrow Text (for Announcement Badge)" },
					{ type: "text_input", action_id: "eyebrowUrl", label: "Eyebrow URL" },
					{ type: "text_input", action_id: "eyebrowCta", label: "Eyebrow CTA Label" },
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{ type: "text_input", action_id: "primaryCtaLabel", label: "Primary CTA label" },
					{ type: "text_input", action_id: "primaryCtaUrl", label: "Primary CTA URL" },
					{
						type: "text_input",
						action_id: "secondaryCtaLabel",
						label: "Secondary CTA label",
					},
					{ type: "text_input", action_id: "secondaryCtaUrl", label: "Secondary CTA URL" },
					{ type: "toggle", action_id: "centered", label: "Center the layout" },
					{ type: "text_input", action_id: "photoUrl", label: "Photo URL (for Left Aligned with Photo)" },
					{
						type: "select",
						action_id: "serviceSlug",
						label: "Service (to load dynamically)",
						optionsRoute: "services",
						options: [],
					},
					{
						type: "repeater",
						action_id: "plans",
						label: "Plans (for Pricing Hero Multi Tier)",
						item_label: "Plan",
						fields: [
							{ type: "text_input", action_id: "name", label: "Plan name" },
							{ type: "text_input", action_id: "priceMonthly", label: "Price (Monthly)" },
							{ type: "text_input", action_id: "priceYearly", label: "Price (Yearly)" },
							{ type: "text_input", action_id: "description", label: "Description" },
							{
								type: "text_input",
								action_id: "features",
								label: "Features (one per line)",
								multiline: true,
							},
							{ type: "text_input", action_id: "ctaLabel", label: "CTA label" },
							{ type: "text_input", action_id: "ctaUrl", label: "CTA URL" },
							{ type: "text_input", action_id: "badge", label: "Badge (e.g. Most popular)" },
							{ type: "toggle", action_id: "highlighted", label: "Highlight this plan" },
						],
					},
				],
			},

			{
				type: "marketing.features",
				label: "Features",
				category: "Sections",
				description: "Grid of feature cards with icons",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{
						type: "repeater",
						action_id: "features",
						label: "Features",
						item_label: "Feature",
						min_items: 1,
						max_items: 12,
						fields: [
							{
								type: "select",
								action_id: "icon",
								label: "Icon",
								options: ICON_OPTIONS,
							},
							{ type: "text_input", action_id: "title", label: "Title" },
							{
								type: "text_input",
								action_id: "description",
								label: "Description",
								multiline: true,
							},
						],
					},
				],
			},

			{
				type: "marketing.testimonials",
				label: "Testimonials",
				category: "Sections",
				description: "Customer testimonial cards",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "select",
						action_id: "serviceSlug",
						label: "Service (to load dynamically)",
						optionsRoute: "services",
						options: [],
					},
					{
						type: "repeater",
						action_id: "testimonials",
						label: "Testimonials",
						item_label: "Testimonial",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "quote", label: "Quote", multiline: true },
							{ type: "text_input", action_id: "author", label: "Author name" },
							{ type: "text_input", action_id: "role", label: "Role / title" },
							{ type: "text_input", action_id: "company", label: "Company" },
							{ type: "text_input", action_id: "avatar", label: "Avatar URL" },
						],
					},
				],
			},

			{
				type: "marketing.pricing",
				label: "Pricing",
				category: "Sections",
				description: "Pricing plan comparison cards",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "select",
						action_id: "serviceSlug",
						label: "Service (to load dynamically)",
						optionsRoute: "services",
						options: [],
					},
					{
						type: "repeater",
						action_id: "plans",
						label: "Plans",
						item_label: "Plan",
						min_items: 1,
						max_items: 6,
						fields: [
							{ type: "text_input", action_id: "name", label: "Plan name" },
							{
								type: "text_input",
								action_id: "price",
								label: "Price",
								placeholder: "$29 or Custom",
							},
							{
								type: "text_input",
								action_id: "period",
								label: "Period",
								placeholder: "/month",
							},
							{
								type: "text_input",
								action_id: "description",
								label: "Description",
								multiline: true,
							},
							{
								type: "text_input",
								action_id: "features",
								label: "Features (one per line)",
								multiline: true,
								placeholder: "Unlimited projects\nPriority support\nSSO",
							},
							{ type: "text_input", action_id: "ctaLabel", label: "CTA label" },
							{ type: "text_input", action_id: "ctaUrl", label: "CTA URL" },
							{ type: "toggle", action_id: "highlighted", label: "Highlight this plan" },
						],
					},
				],
			},

			{
				type: "marketing.faq",
				label: "FAQ",
				category: "Sections",
				description: "Frequently asked questions",
				fields: [
					{
						type: "select",
						action_id: "variation",
						label: "Variation",
						options: [
							{ label: "Two Column Accordion", value: "two-column" },
							{ label: "Centered Accordion", value: "centered" },
						],
					},
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{
						type: "select",
						action_id: "serviceSlug",
						label: "Service (to load dynamically)",
						optionsRoute: "services",
						options: [],
					},
					{
						type: "repeater",
						action_id: "items",
						label: "Questions",
						item_label: "Question",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "question", label: "Question" },
							{
								type: "text_input",
								action_id: "answer",
								label: "Answer",
								multiline: true,
							},
						],
					},
				],
			},

			{
				type: "marketing.stats",
				label: "Stats",
				category: "Sections",
				description: "Stats display section with a graph background",
				fields: [
					{ type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{
						type: "repeater",
						action_id: "stats",
						label: "Stats",
						item_label: "Stat",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "stat", label: "Stat value (e.g. 99%)" },
							{ type: "text_input", action_id: "text", label: "Stat text" },
						],
					},
				],
			},

			{
				type: "marketing.team",
				label: "Team",
				category: "Sections",
				description: "Grid of team members",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{
						type: "select",
						action_id: "serviceSlug",
						label: "Service (to load dynamically)",
						optionsRoute: "services",
						options: [],
					},
					{
						type: "repeater",
						action_id: "members",
						label: "Members",
						item_label: "Member",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "name", label: "Name" },
							{ type: "text_input", action_id: "byline", label: "Byline/Role" },
							{ type: "text_input", action_id: "img", label: "Photo URL" },
						],
					},
				],
			},

			{
				type: "marketing.cta",
				label: "Call to Action",
				category: "Sections",
				description: "Call to action section",
				fields: [
					{
						type: "select",
						action_id: "variation",
						label: "Variation",
						options: [
							{ label: "Left Aligned", value: "left-aligned" },
							{ label: "Centered", value: "centered" },
						],
					},
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{ type: "text_input", action_id: "primaryCtaLabel", label: "Primary CTA label" },
					{ type: "text_input", action_id: "primaryCtaUrl", label: "Primary CTA URL" },
					{
						type: "text_input",
						action_id: "secondaryCtaLabel",
						label: "Secondary CTA label",
					},
					{ type: "text_input", action_id: "secondaryCtaUrl", label: "Secondary CTA URL" },
				],
			},

			{
				type: "marketing.comparison",
				label: "Feature Comparison Table",
				category: "Sections",
				description: "Detailed feature comparison table for plans",
				fields: [
					{
						type: "repeater",
						action_id: "items",
						label: "Comparison Rows",
						item_label: "Row",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "groupName", label: "Group Name (e.g. Collaboration)" },
							{ type: "text_input", action_id: "name", label: "Feature Name (e.g. Private notes)" },
							{ type: "text_input", action_id: "starterValue", label: "Starter Value (true/false/text)" },
							{ type: "text_input", action_id: "growthValue", label: "Growth Value (true/false/text)" },
							{ type: "text_input", action_id: "proValue", label: "Pro Value (true/false/text)" },
						],
					},
				],
			},

			{
				type: "marketing.document",
				label: "Document Content",
				category: "Sections",
				description: "Text document layout for policy and legal pages",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{
						type: "text_input",
						action_id: "content",
						label: "Document Content (HTML)",
						multiline: true,
					},
				],
			},
		],
	},
};

export function createPlugin() {
	return definePlugin(definition);
}

export default createPlugin;
