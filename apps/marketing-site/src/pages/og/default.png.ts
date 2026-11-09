import { socialBackground } from "../../styles/palette";
import type { APIRoute } from "astro";
import { getSiteSettings } from "emdash";
import { ImageResponse, loadGoogleFont } from "workers-og";

export const GET: APIRoute = async ({ url }) => {
	const settings = await getSiteSettings();
	const siteTitle = settings?.title || "Oatmeal";
	const siteDescription = settings?.tagline || "Customer support that feels like a conversation.";

	// Fetch fonts from Google Fonts at request-time
	const [interSemiBold, interRegular] = await Promise.all([
		loadGoogleFont({ family: "Inter", weight: 600 }),
		loadGoogleFont({ family: "Inter", weight: 400 }),
	]);

	const html = `
		<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: ${socialBackground}; color: white; padding: 70px 90px; justify-content: space-between; font-family: 'Inter', sans-serif;">
			<div style="display: flex; flex-direction: column; justify-content: center; height: 100%;">
				<div style="font-size: 32px; font-weight: 600; opacity: 0.95; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 2.5px;">
					${siteTitle}
				</div>
				<div style="font-size: 60px; font-weight: 700; line-height: 1.3; margin-bottom: 24px;">
					${siteDescription}
				</div>
			</div>
			<div style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.25); padding-top: 35px; margin-top: auto;">
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
