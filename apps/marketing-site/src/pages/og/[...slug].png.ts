import { socialBackground } from "../../styles/palette";
import type { APIRoute } from "astro";
import { getEmDashEntry, getSiteSettings } from "emdash";
import { ImageResponse, loadGoogleFont } from "workers-og";

export const GET: APIRoute = async ({ params, url }) => {
	const slug = params.slug;
	if (!slug) {
		return new Response("Not found", { status: 404 });
	}

	// Determine collection and entry ID
	let collection = "pages";
	let entryId = slug;

	if (slug.includes("/")) {
		const parts = slug.split("/");
		const prefix = parts[0];
		entryId = parts.slice(1).join("/");
		if (prefix === "blog") {
			collection = "posts";
		} else if (prefix === "work") {
			collection = "projects";
		} else if (prefix === "pages") {
			collection = "pages";
		}
	}

	// Fetch entry from database
	let title = "";
	let subtitle = "";
	try {
		const { entry } = await getEmDashEntry(collection as any, entryId);
		if (entry) {
			const data = entry.data as any;
			title = data.title || data.quote || "";
			subtitle = data.excerpt || data.summary || data.author || "";
		}
	} catch (e) {
		// Fallback
	}

	// Fetch settings for default fallback
	const settings = await getSiteSettings();
	const siteTitle = settings?.title || "Oatmeal";
	if (!title) {
		title = siteTitle;
	}
	if (!subtitle) {
		subtitle = settings?.tagline || "";
	}

	// Fetch fonts from Google Fonts at request-time
	const [interSemiBold, interRegular] = await Promise.all([
		loadGoogleFont({ family: "Inter", weight: 600 }),
		loadGoogleFont({ family: "Inter", weight: 400 }),
	]);

	// Use the same olive background as the site.
	const html = `
		<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: ${socialBackground}; color: white; padding: 70px 90px; justify-content: space-between; font-family: 'Inter', sans-serif;">
			<div style="display: flex; flex-direction: column;">
				<div style="font-size: 26px; font-weight: 600; opacity: 0.95; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2.5px;">
					${siteTitle}
				</div>
				<div style="font-size: 60px; font-weight: 700; line-height: 1.25; max-height: 310px; overflow: hidden; text-overflow: ellipsis;">
					${title}
				</div>
			</div>
			<div style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.25); padding-top: 35px; margin-top: auto;">
				<div style="font-size: 24px; opacity: 0.85; font-weight: 400; max-width: 800px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
					${subtitle}
				</div>
				<div style="font-size: 20px; font-weight: 600; background: rgba(255, 255, 255, 0.18); padding: 12px 28px; border-radius: 100px; border: 1px solid rgba(255, 255, 255, 0.1);">
					${url.host}
				</div>
			</div>
		</div>
	`;

	return new ImageResponse(html, {
		width: 1200,
		height: 630,
		fonts: [
			{
				name: "Inter",
				data: interSemiBold,
				weight: 600,
				style: "normal",
			},
			{
				name: "Inter",
				data: interRegular,
				weight: 400,
				style: "normal",
			},
		],
		headers: {
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
