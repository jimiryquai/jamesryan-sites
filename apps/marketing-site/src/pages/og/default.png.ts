import { getOgSiteImage } from "@jamesryan/cms-helpers/og";
import type { APIRoute } from "astro";
import { socialBackground } from "../../styles/palette";

export const GET: APIRoute = ({ url, cache }) =>
	getOgSiteImage({ url, cache }, {
		defaultTitle: "James Ryan",
		defaultDescription: "",
		socialBackground,
	});
