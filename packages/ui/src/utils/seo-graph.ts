import { makeIds, buildImageObject, buildPiece, buildWebSite } from "@jdevalk/seo-graph-core";
import type { Person, Blog } from "schema-dts";

/** Canonical site entities shared by HTML and collection discovery graphs. */
export function buildSiteGraph(url: string, siteTitle: string, siteDescription: string) {
	const siteUrl = url.replace(/\/+$/, "");
	const ids = makeIds({ siteUrl });

	const personImagePiece = buildImageObject(
		{
			id: ids.personImage,
			url: `${siteUrl}/images/avatar.webp`,
			width: 400,
			height: 400,
		},
		ids,
	);

	const personPiece = buildPiece<Person>({
		"@type": "Person",
		"@id": ids.person,
		name: "James Ryan",
		givenName: "James",
		familyName: "Ryan",
		url: `${siteUrl}/about`,
		image: { "@id": ids.personImage },
		sameAs: [
			"https://www.linkedin.com/in/jimiryquai/",
			"https://www.x.com/jimiryquai",
		],
		jobTitle: "Senior Power Platform Technical Consultant",
		worksFor: {
			"@type": "EmployeeRole",
			roleName: "Senior Power Platform Technical Consultant",
			worksFor: {
				"@type": "Organization",
				name: "Capgemini",
				url: "https://www.capgemini.com/",
			},
		},
		knowsAbout: [
			"Power Platform",
			"Software Development",
			"Cloud Computing",
			"Data Modeling",
		],
	});

	const blogId = `${siteUrl}/posts/#blog`;
	const blogPiece = buildPiece<Blog>({
		"@type": "Blog",
		"@id": blogId,
		name: siteTitle,
		description: siteDescription,
		url: `${siteUrl}/posts/`,
		publisher: { "@id": ids.person },
		inLanguage: "en-US",
	});

	const websitePiece = buildWebSite(
		{
			url: siteUrl,
			name: siteTitle,
			description: siteDescription,
			publisher: { "@id": ids.person },
			inLanguage: "en-US",
		},
		ids,
	);

	return { ids, blogId, pieces: [personPiece, personImagePiece, blogPiece, websitePiece] };
}
