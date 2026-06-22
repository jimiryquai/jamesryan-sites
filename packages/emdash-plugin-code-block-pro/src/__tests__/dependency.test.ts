import { describe, it, expect } from "vitest";

describe("Emdash Dependency Exports", () => {
	it("resolves and exports emdashLoader and getDb from 'emdash/runtime'", async () => {
		// Dynamically import to catch resolution/load-time syntax and export errors
		const runtime = await import("emdash/runtime");
		
		expect(runtime).toBeDefined();
		expect(runtime.emdashLoader).toBeDefined();
		expect(typeof runtime.emdashLoader).toBe("function");
		
		expect(runtime.getDb).toBeDefined();
		expect(typeof runtime.getDb).toBe("function");
	});
});
