import { describe, it, expect } from "vitest";
import { CodeBlockProData } from "../admin.js";
import { LANGUAGES, THEMES, DEFAULT_THEME, DEFAULT_LANGUAGE, LANGUAGE_VALUES, THEME_VALUES } from "../constants.js";

describe("admin module", () => {
	it("exports the CodeBlockProData interface type", () => {
		// TypeScript compile-time check — if this compiles, the type exists
		const data: CodeBlockProData = {
			code: "console.log('hello')",
			language: "javascript",
			theme: "github-dark",
		};
		expect(data.code).toBe("console.log('hello')");
	});

	it("CodeBlockProData accepts all optional fields", () => {
		const data: CodeBlockProData = {
			code: "test",
			language: "typescript",
			theme: "dracula",
			filename: "test.ts",
			lineNumbers: true,
			startingLineNumber: "5",
			lineHighlights: "1,3-5",
			copyButton: false,
			maxHeight: "400px",
		};
		expect(data.filename).toBe("test.ts");
		expect(data.lineNumbers).toBe(true);
		expect(data.copyButton).toBe(false);
	});

	it("CodeBlockProData allows empty object", () => {
		const data: CodeBlockProData = {};
		expect(data.code).toBeUndefined();
	});
});

describe("constants", () => {
	it("LANGUAGES has at least 10 entries", () => {
		expect(LANGUAGES.length).toBeGreaterThanOrEqual(10);
	});

	it("THEMES has 24 entries", () => {
		expect(THEMES.length).toBe(24);
	});

	it("THEMES includes key entries", () => {
		const themeValues = THEMES.map((t) => t.value);
		expect(themeValues).toContain("github-dark");
		expect(themeValues).toContain("synthwave-84");
		expect(themeValues).toContain("rose-pine");
		expect(themeValues).toContain("dracula");
	});

	it("DEFAULT_THEME is a valid theme value", () => {
		expect(THEME_VALUES).toContain(DEFAULT_THEME);
	});

	it("DEFAULT_LANGUAGE is a valid language value", () => {
		expect(LANGUAGE_VALUES).toContain(DEFAULT_LANGUAGE);
	});

	it("LANGUAGE_VALUES matches LANGUAGES entries", () => {
		expect(LANGUAGE_VALUES).toHaveLength(LANGUAGES.length);
		for (const lang of LANGUAGES) {
			expect(LANGUAGE_VALUES).toContain(lang.value);
		}
	});

	it("THEME_VALUES matches THEMES entries", () => {
		expect(THEME_VALUES).toHaveLength(THEMES.length);
		for (const theme of THEMES) {
			expect(THEME_VALUES).toContain(theme.value);
		}
	});

	it("all options have non-empty label and value", () => {
		for (const lang of LANGUAGES) {
			expect(lang.label.length).toBeGreaterThan(0);
			expect(lang.value.length).toBeGreaterThan(0);
		}
		for (const theme of THEMES) {
			expect(theme.label.length).toBeGreaterThan(0);
			expect(theme.value.length).toBeGreaterThan(0);
		}
	});
});
