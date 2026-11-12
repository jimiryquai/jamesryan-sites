/** Resolved media reference from getSiteSettings(). */
export interface MediaReference {
	mediaId: string;
	alt?: string;
	url?: string;
}

export interface SiteIdentitySettings {
	title?: string;
	tagline?: string;
	logo?: MediaReference;
}

export interface SiteIdentityOptions {
	site?: URL | string;
	requestUrl?: URL;
}

/** CMS settings own identity; the configured site owns its public origin. */
export function resolveSiteIdentity(settings?: SiteIdentitySettings, options: SiteIdentityOptions = {}) {
	const siteUrl = (options.site?.toString() || options.requestUrl?.origin || "https://jamesryan.dev").replace(/\/+$/, "");
	const hostname = new URL(siteUrl).hostname;
	const defaultTagline = hostname === "jamesryan.dev" || hostname.endsWith(".jamesryan.dev")
		? "AI-native marketer & engineer building intelligent marketing engines and software tools."
		: "Notes, essays, and software experiments from James Ryan.";
	return {
		siteTitle: settings?.title || "James Ryan",
		siteTagline: settings?.tagline || defaultTagline,
		siteLogo: settings?.logo?.url ? settings.logo : null,
		siteUrl,
	};
}
