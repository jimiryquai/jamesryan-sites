import { getOgEntryImage } from "@jamesryan/cms-helpers/og";
import type { APIRoute } from "astro";
import { socialBackground } from "../../styles/palette";

export const GET: APIRoute = ({ params, url, cache }) =>
	getOgEntryImage({ params: { slug: params.slug }, url, cache }, {
		defaultTitle: "James Ryan",
		defaultDescription: "",
		socialBackground,
	});
