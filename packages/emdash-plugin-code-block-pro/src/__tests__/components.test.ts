import { describe, it, expect, beforeAll } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import CodeBlockPro from "../astro/CodeBlockPro.astro";

describe("CodeBlockPro.astro — real Astro rendering", () => {
	let container: Awaited<ReturnType<typeof AstroContainer.create>>;

	beforeAll(async () => {
		container = await AstroContainer.create();
	});

	it("renders Shiki-highlighted code", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "const y = 2;",
					language: "javascript",
				},
			},
		});

		expect(html).toContain('class="shiki');
		expect(html).toMatch(/<span style="color:/);
		expect(html).toContain("const");
	});

	it("adds cbp-highlighted class to highlighted lines", async () => {
		// Multi-line code so line highlights have an effect
		const code = "line one\nline two\nline three\nline four";
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code,
					language: "text",
					lineHighlights: "2-3",
				},
			},
		});

		// Lines 2 and 3 should get the class
		expect(html).toContain("cbp-highlighted");
		// There should be exactly 2 occurrences of cbp-highlighted (lines 2 and 3)
		const matches = html.match(/cbp-highlighted/g);
		expect(matches).not.toBeNull();
		expect(matches!.length).toBe(2);
	});

	it("renders filename header with language badge", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "hello",
					language: "typescript",
					filename: "app.ts",
				},
			},
		});

		expect(html).toContain("cbp-header");
		expect(html).toContain("cbp-filename");
		expect(html).toContain("app.ts");
		expect(html).toContain("cbp-lang-badge");
		expect(html).toContain("typescript");
	});

	it("renders copy button by default", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "hello",
					language: "text",
				},
			},
		});

		expect(html).toContain("cbp-copy-btn");
	});

	it("hides copy button when copyButton is false", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "hello",
					language: "text",
					copyButton: false,
				},
			},
		});

		expect(html).not.toContain("cbp-copy-btn");
	});

	it("adds line-numbers class when lineNumbers is true", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "hello\nworld",
					language: "text",
					lineNumbers: true,
				},
			},
		});

		expect(html).toContain("cbp-has-line-numbers");
	});

	it("does not add line-numbers class when lineNumbers is false", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "hello\nworld",
					language: "text",
					lineNumbers: false,
				},
			},
		});

		expect(html).not.toContain("cbp-has-line-numbers");
	});

	it("respects custom theme", async () => {
		// Should not throw — just verify it renders with a different theme
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "hello",
					language: "text",
					theme: "github-light",
				},
			},
		});

		expect(html).toContain('class="shiki');
	});

	it("wraps output in .cbp-wrapper", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "hello",
					language: "text",
				},
			},
		});

		expect(html).toContain("cbp-wrapper");
	});

	it("handles empty code gracefully", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "",
					language: "text",
				},
			},
		});

		// Should render a container even with empty code
		expect(html).toContain("cbp-wrapper");
	});

	it("stores trimmed code in data-code attribute of copy button", async () => {
		const code = "hello\nworld\n";
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code,
					language: "text",
				},
			},
		});

		// data-code should contain the code (trailing newline stripped)
		expect(html).toContain('data-code="hello\nworld"');
	});

	it("injects custom starting line number style when lineNumbers is true and startingLineNumber is provided", async () => {
		const html = await container.renderToString(CodeBlockPro as AstroComponentFactory, {
			props: {
				node: {
					_type: "code-block-pro",
					code: "line one\nline two",
					language: "text",
					lineNumbers: true,
					startingLineNumber: 10,
				},
			},
		});

		expect(html).toContain('style="counter-reset:cbp-line 9"');
	});
});
