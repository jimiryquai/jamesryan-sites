import { describe, it, expect } from "vitest";
import { parseLineHighlights } from "../utils/parseLineHighlights.js";

describe("parseLineHighlights", () => {
	it("returns an empty set for an empty string", () => {
		const result = parseLineHighlights("");
		expect(result.size).toBe(0);
	});

	it("returns an empty set for whitespace-only input", () => {
		expect(parseLineHighlights("   ").size).toBe(0);
		expect(parseLineHighlights("\t").size).toBe(0);
		expect(parseLineHighlights("  \n  ").size).toBe(0);
	});

	it("parses a single number", () => {
		const result = parseLineHighlights("3");
		expect(result).toEqual(new Set([3]));
	});

	it("parses a comma-separated list", () => {
		const result = parseLineHighlights("1,3,7");
		expect(result).toEqual(new Set([1, 3, 7]));
	});

	it("parses a range", () => {
		const result = parseLineHighlights("3-5");
		expect(result).toEqual(new Set([3, 4, 5]));
	});

	it("parses mixed single numbers and ranges", () => {
		const result = parseLineHighlights("1,3-5,7");
		expect(result).toEqual(new Set([1, 3, 4, 5, 7]));
	});

	it("handles whitespace around parts", () => {
		const result = parseLineHighlights(" 1 , 3 - 5 , 7 ");
		expect(result).toEqual(new Set([1, 3, 4, 5, 7]));
	});

	it("handles a single-element range (start === end)", () => {
		const result = parseLineHighlights("4-4");
		expect(result).toEqual(new Set([4]));
	});

	it("ignores ranges where end < start", () => {
		const result = parseLineHighlights("5-3");
		expect(result.size).toBe(0);
	});

	it("ignores non-numeric parts", () => {
		const result = parseLineHighlights("abc");
		expect(result.size).toBe(0);
	});

	it("ignores malformed ranges gracefully", () => {
		const result = parseLineHighlights("a-b");
		expect(result.size).toBe(0);
	});

	it("handles duplicate numbers by deduplicating via Set", () => {
		const result = parseLineHighlights("3,3,3");
		expect(result).toEqual(new Set([3]));
	});

	it("handles overlapping ranges and singles", () => {
		const result = parseLineHighlights("1-5,3,4");
		expect(result).toEqual(new Set([1, 2, 3, 4, 5]));
	});

	it("handles a large range", () => {
		const result = parseLineHighlights("1-100");
		expect(result.size).toBe(100);
		expect(result.has(1)).toBe(true);
		expect(result.has(50)).toBe(true);
		expect(result.has(100)).toBe(true);
	});

	it("returns an empty set for null-ish input (defensive)", () => {
		// The function accepts string, but if called with undefined via JS
		expect(parseLineHighlights(undefined as unknown as string).size).toBe(0);
	});
});
