import { test } from "node:test";
import assert from "node:assert/strict";
import { portableTextToMarkdown } from "../src/index.ts";

test("a code-block-pro block becomes a fenced code block with its language", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "code-block-pro",
			code: "const n = 1;",
			language: "typescript",
			filename: "sample.ts",
		}]),
		"```typescript\nconst n = 1;\n```\n\n",
	);
});

test("a code block uses the same fence", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "code",
			code: "fixture privacy-policy prose code block",
			language: "js",
		}]),
		"```js\nfixture privacy-policy prose code block\n```\n\n",
	);
});

test("a code block that contains a fence uses a longer fence", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "code",
			code: "```\nalert(1)\n```",
			language: "js",
		}]),
		"````js\n```\nalert(1)\n```\n````\n\n",
	);
});

test("a language info string keeps only its first token", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "code",
			code: "const n = 1;\n",
			language: " `js` \ninjected https://evil.example",
		}]),
		"```js\nconst n = 1;\n```\n\n",
	);
});

test("a blockquote is prefixed with \"> \" on every line", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "block",
			style: "blockquote",
			children: [{ _type: "span", text: "First line\nSecond line" }],
		}]),
		"> First line\n> Second line\n\n",
	);
});

test("an image block becomes a Markdown image from alt and url, src, or value", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "image",
			alt: "Screenshot of Enable Static Result",
			url: "https://cdn.example/enable.png",
		}]),
		"![Screenshot of Enable Static Result](https://cdn.example/enable.png)\n\n",
	);
	assert.equal(
		portableTextToMarkdown([{ _type: "image", alt: "From src", src: "/images/src.png" }]),
		"![From src](/images/src.png)\n\n",
	);
	assert.equal(
		portableTextToMarkdown([{ _type: "image", alt: "From value", value: "/images/value.png" }]),
		"![From value](/images/value.png)\n\n",
	);
});

test("a resolved media src is the image URL, and a seed file path is used when that is all there is", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "image",
			alt: "Resolved",
			asset: { src: "/_emdash/api/media/file/abc", $media: { file: "assets/x.png" } },
		}]),
		"![Resolved](/_emdash/api/media/file/abc)\n\n",
	);
	assert.equal(
		portableTextToMarkdown([{
			_type: "image",
			alt: "Screenshot of Catch Block",
			asset: { $media: { file: "assets/catch-block.png", alt: "Screenshot of Catch Block" } },
		}]),
		"![Screenshot of Catch Block](assets/catch-block.png)\n\n",
	);
});

test("an image falls back to asset._ref when no url or storage key is stored", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "image",
			alt: "Referenced",
			asset: { _ref: "image-abc" },
		}]),
		"![Referenced](/_emdash/api/media/file/image-abc)\n\n",
	);
});

test("parentheses in an image URL are wrapped and brackets in the alt are escaped", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "image",
			alt: "shot [1]",
			url: "https://cdn.example/a(b).png",
		}]),
		"![shot \\[1\\]](<https://cdn.example/a(b).png>)\n\n",
	);
});

test("a javascript image URL and a javascript link are not emitted", () => {
	assert.equal(
		portableTextToMarkdown([{ _type: "image", alt: "Bad", url: "javascript:alert(1)" }]),
		"",
	);
	assert.equal(
		portableTextToMarkdown([{
			_type: "block",
			style: "normal",
			markDefs: [{ _key: "link", _type: "link", href: "javascript:alert(1)" }],
			children: [{ text: "click", marks: ["link"] }],
		}]),
		"click\n\n",
	);
});

test("a list is separated from the paragraph that follows it", () => {
	assert.equal(
		portableTextToMarkdown([
			{ _type: "block", listItem: "bullet", children: [{ text: "One" }] },
			{ _type: "block", style: "normal", children: [{ text: "After" }] },
		]),
		"- One\n\nAfter\n\n",
	);
});

test("headings and inline marks stay in the Markdown", () => {
	assert.equal(
		portableTextToMarkdown([{
			_type: "block",
			style: "h2",
			markDefs: [{ _key: "link", _type: "link", href: "https://example.com" }],
			children: [
				{ text: "Hello", marks: ["strong", "em", "code"] },
				{ text: " there", marks: ["link"] },
			],
		}]),
		"## ***`Hello`***[ there](https://example.com)\n\n",
	);
});
