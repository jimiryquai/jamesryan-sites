#!/usr/bin/env node
// THROWAWAY SPIKE (ticket 25): build the fixture seed for the visual-editor
// compatibility experiment. Extends the site's real seed with:
//   - pages/vx-test: one published page holding all ten block types
//   - pages/vx-blank: one published page with an empty layout (add/move/delete flows)
//   - shared-content collection entries (testimonials, faqs, pricing, team)
// Local only; nothing here merges or deploys.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "../../apps/marketing-site"); // repo root is two levels up from .orchestrate/spike
const seed = JSON.parse(readFileSync(join(app, "seed/seed.json")));

const paragraph = (key, text) => [{ _type: "block", _key: key, style: "normal", children: [
	{ _type: "span", _key: `${key}-span`, text },
] }];

const layout = [
	{ _type: "hero", _key: "vx-hero", _version: 1, variant: "photo",
		eyebrow: "Spike eyebrow", eyebrow_url: "/posts", eyebrow_action: "See posts",
		heading: "VX test hero heading", body: "VX test hero body copy.",
		image: { $media: { file: "assets/api-key.png", alt: "VX hero image" } },
		links: [
			{ label: "Primary link", url: "/posts" },
			{ label: "Secondary link", url: "/about" },
		] },
	{ _type: "cta", _key: "vx-cta", _version: 1, variant: "start",
		heading: "VX test CTA heading", body: "VX test CTA body.",
		links: [{ label: "CTA link", url: "/pricing" }] },
	{ _type: "features", _key: "vx-features", _version: 1, variant: "three-column",
		eyebrow: "Features eyebrow", heading: "VX test features heading", subheadline: "VX test features subheadline.",
		items: [
			{ _key: "vx-feat-1", title: "Feature one", description: "Feature one description.", icon: "zap" },
			{ _key: "vx-feat-2", title: "Feature two", description: "Feature two description.", icon: "shield" },
			{ _key: "vx-feat-3", title: "Feature three", description: "Feature three description.", icon: "globe" },
		] },
	{ _type: "stats", _key: "vx-stats", _version: 1, variant: "graph",
		eyebrow: "Stats eyebrow", heading: "VX test stats heading", body: "VX test stats body.",
		items: [
			{ _key: "vx-stat-1", value: "99%", label: "Stat one label" },
			{ _key: "vx-stat-2", value: "42", label: "Stat two label" },
			{ _key: "vx-stat-3", value: "12k", label: "Stat three label" },
		] },
	{ _type: "comparison", _key: "vx-comparison", _version: 1, variant: "table",
		columns: [
			{ _key: "vx-col-1", key: "first", label: "Starter" },
			{ _key: "vx-col-2", key: "second", label: "Growth" },
			{ _key: "vx-col-3", key: "third", label: "Pro" },
		],
		rows: [
			{ _key: "vx-row-1", group_name: "Platform", name: "Row one", first_value: "true", second_value: "false", third_value: "true" },
			{ _key: "vx-row-2", group_name: "Platform", name: "Row two", first_value: "5", second_value: "50", third_value: "Unlimited" },
		] },
	{ _type: "prose", _key: "vx-prose", _version: 1, variant: "centered",
		heading: "VX test prose heading", body: "VX test prose body.",
		content: paragraph("vx-prose-p", "VX test prose paragraph with a code block following.") },
	{ _type: "testimonials", _key: "vx-testimonials", _version: 1, variant: "grid", scope: "all" },
	{ _type: "pricing", _key: "vx-pricing", _version: 1, variant: "tiers", scope: "all" },
	{ _type: "faq", _key: "vx-faq", _version: 1, variant: "two-column", scope: "all" },
	{ _type: "team", _key: "vx-team", _version: 1, variant: "three-column", scope: "all" },
];

const content = seed.content ?? {};
content.pages = [
	...(content.pages ?? []),
	{ id: "vx-test", slug: "vx-test", status: "published", data: { title: "VX Test Page", layout } },
	{ id: "vx-blank", slug: "vx-blank", status: "published", data: { title: "VX Blank Page", layout: [] } },
];
content.testimonials = (content.testimonials ?? []).concat([
	{ id: "vx-quote-1", slug: "vx-quote-1", status: "published", data: {
		quote: "VX testimonial one quote.", author: "Quote One Author", role: "Engineer", company: "One Co",
		avatar: { $media: { file: "assets/api-key.png", alt: "Avatar one" } } } },
	{ id: "vx-quote-2", slug: "vx-quote-2", status: "published", data: {
		quote: "VX testimonial two quote.", author: "Quote Two Author", role: "Designer", company: "Two Co" } },
	{ id: "vx-quote-3", slug: "vx-quote-3", status: "published", data: {
		quote: "VX testimonial three quote.", author: "Quote Three Author", role: "Founder", company: "Three Co" } },
]);
content.faqs = (content.faqs ?? []).concat([
	{ id: "vx-faq-1", slug: "vx-faq-1", status: "published", data: { question: "VX question one?", answer: "VX answer one." } },
	{ id: "vx-faq-2", slug: "vx-faq-2", status: "published", data: { question: "VX question two?", answer: "VX answer two." } },
	{ id: "vx-faq-3", slug: "vx-faq-3", status: "published", data: { question: "VX question three?", answer: "VX answer three." } },
]);
content.pricing = (content.pricing ?? []).concat([
	{ id: "vx-plan-1", slug: "vx-plan-1", status: "published", data: {
		name: "Starter", price: "9", period: "/mo", description: "VX starter plan.",
		features: "VX feature A\nVX feature B", cta_label: "Choose Starter", cta_url: "/contact" } },
	{ id: "vx-plan-2", slug: "vx-plan-2", status: "published", data: {
		name: "Growth", price: "29", period: "/mo", description: "VX growth plan.",
		features: "VX feature A\nVX feature B\nVX feature C", cta_label: "Choose Growth", cta_url: "/contact",
		badge: "Most popular", highlighted: true } },
	{ id: "vx-plan-3", slug: "vx-plan-3", status: "published", data: {
		name: "Pro", price: "99", period: "/mo", description: "VX pro plan.",
		features: "Everything in Growth\nVX priority support", cta_label: "Choose Pro", cta_url: "/contact" } },
]);
content.team = (content.team ?? []).concat([
	{ id: "vx-member-1", slug: "vx-member-1", status: "published", data: {
		name: "Member One", role: "Role One", image: { $media: { file: "assets/api-key.png", alt: "Member one" } } } },
	{ id: "vx-member-2", slug: "vx-member-2", status: "published", data: { name: "Member Two", role: "Role Two" } },
	{ id: "vx-member-3", slug: "vx-member-3", status: "published", data: { name: "Member Three", role: "Role Three" } },
]);
seed.content = content;

mkdirSync(join(here, "fixture/assets"), { recursive: true });
copyFileSync(join(app, "seed/assets/api-key.png"), join(here, "fixture/assets/api-key.png"));
const out = join(here, "fixture/fixture.json");
writeFileSync(out, JSON.stringify(seed, null, 1));
console.log(`fixture seed written: ${out}`);
