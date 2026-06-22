import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettings } from "emdash";
import { makeIds, assembleGraph, buildWebSite, buildWebPage, buildArticle, buildPiece, buildImageObject } from "@jdevalk/seo-graph-core";
import type { Person, Blog } from "schema-dts";

export const GET: APIRoute = async ({ params, site, url }) => {
	const { collection } = params;
	if (!collection || !["pages", "posts", "projects"].includes(collection)) {
		return new Response("Not found", { status: 404 });
	}

	const siteUrl = site?.toString().replace(/\/$/, "") || url.origin;
	const settings = await getSiteSettings();
	const siteTitle = settings?.title || "Oatmeal Digital Garden";
	const siteDescription = settings?.tagline || "Customer support that feels like a conversation.";

	// Query EmDash collection
	const { entries } = await getEmDashCollection(collection as "pages" | "posts" | "projects", { limit: 100 });

	const ids = makeIds({ siteUrl });

	const allPieces: any[] = [];

	// Build common site entities
	const personImagePiece = buildImageObject({
		id: ids.personImage,
		url: `${siteUrl}/images/avatar.webp`,
		width: 400,
		height: 400,
	}, ids);

	const personPiece = buildPiece<Person>({
		"@type": "Person",
		"@id": ids.person,
		name: "James Ryan",
		givenName: "James",
		familyName: "Ryan",
		url: `${siteUrl}/about`,
		image: { "@id": ids.personImage },
		sameAs: [
			"https://www.linkedin.com/in/jamesryan.dev/",
			"https://www.x.com/jimiryquai"
		],
		jobTitle: "Senior Power Platform Technical Consultant",
		worksFor: {
			"@type": "EmployeeRole",
			roleName: "Senior Power Platform Technical Consultant",
			worksFor: {
				"@type": "Organization",
				name: "Capgemini",
				url: "https://www.capgemini.com/",
			}
		},
		knowsAbout: [
			"Power Platform",
			"Software Development",
			"Cloud Computing",
			"Data Modeling"
		]
	});

	const blogId = `${siteUrl}/blog/#blog`;
	const blogPiece = buildPiece<Blog>({
		"@type": "Blog",
		"@id": blogId,
		name: siteTitle,
		description: siteDescription,
		url: `${siteUrl}/blog/`,
		publisher: { "@id": ids.person },
		inLanguage: "en-US",
	});

	const websitePiece = buildWebSite({
		url: siteUrl,
		name: siteTitle,
		description: siteDescription,
		publisher: { "@id": ids.person },
	}, ids);

	allPieces.push(personPiece, personImagePiece, blogPiece, websitePiece);

	for (const entry of entries) {
		let path = `/pages/${entry.id}`;
		if (collection === "posts") {
			path = `/blog/${entry.id}`;
		} else if (collection === "projects") {
			path = `/work/${entry.id}`;
		} else if (entry.id === "home") {
			path = "/";
		} else if (["about", "pricing", "privacy-policy"].includes(entry.id)) {
			path = `/${entry.id}`;
		}

		const entryUrl = `${siteUrl}${path}`;
		const data = entry.data as unknown as Record<string, unknown>;
		const title = (typeof data.title === "string" ? data.title : null) || (typeof data.quote === "string" ? data.quote : null) || "Untitled";
		const desc = (typeof data.excerpt === "string" ? data.excerpt : null) || (typeof data.author === "string" ? data.author : null) || "";

		const pagePiece = buildWebPage({
			url: entryUrl,
			name: title,
			isPartOf: { "@id": ids.website },
			breadcrumb: { "@id": ids.breadcrumb(entryUrl) },
			datePublished: entry.data.publishedAt ? new Date(entry.data.publishedAt) : undefined,
			dateModified: entry.data.updatedAt ? new Date(entry.data.updatedAt) : undefined,
		}, ids);

		allPieces.push(pagePiece);

		if (collection === "posts") {
			const articlePiece = buildArticle({
				url: entryUrl,
				isPartOf: [
					{ "@id": ids.webPage(entryUrl) },
					{ "@id": blogId }
				] as unknown as { "@id": string },
				author: { "@id": ids.person },
				publisher: { "@id": ids.person },
				headline: title,
				description: desc,
				datePublished: entry.data.publishedAt ? new Date(entry.data.publishedAt) : new Date(),
				dateModified: entry.data.updatedAt ? new Date(entry.data.updatedAt) : undefined,
			}, ids, "BlogPosting");
			allPieces.push(articlePiece);
		}
	}

	const graph = assembleGraph(allPieces);

	return new Response(JSON.stringify(graph, null, 2), {
		headers: {
			"Content-Type": "application/ld+json; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	});
};
