import { describe, it, expect } from "vitest";
import { blockComponents } from "../astro/index.js";

describe("blockComponents export", () => {
	it("has a 'code-block-pro' key", () => {
		expect(blockComponents).toHaveProperty("code-block-pro");
	});

	it("has exactly 1 key", () => {
		expect(Object.keys(blockComponents)).toHaveLength(1);
	});

	it("'code-block-pro' value is a defined component (not null/undefined)", () => {
		expect(blockComponents["code-block-pro"]).toBeDefined();
		expect(blockComponents["code-block-pro"]).not.toBeNull();
	});
});
