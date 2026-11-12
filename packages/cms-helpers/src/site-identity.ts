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
	return {
		siteTitle: settings?.title || "James Ryan",
		siteTagline: settings?.tagline || "Notes, essays, and software experiments from James Ryan.",
		siteLogo: settings?.logo?.url ? settings.logo : null,
		siteUrl: (options.site?.toString() || options.requestUrl?.origin || "https://jamesryan.dev").replace(/\/+$/, ""),
	};
}
