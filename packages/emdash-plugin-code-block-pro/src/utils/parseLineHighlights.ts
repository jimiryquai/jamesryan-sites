/**
 * Parse a line-highlights spec like "1,3-5,7" into a Set of 1-indexed line numbers.
 */
export function parseLineHighlights(spec: string): Set<number> {
	const result = new Set<number>();
	if (!spec?.trim()) return result;
	for (const part of spec.split(",")) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		if (trimmed.includes("-")) {
			const [startStr, endStr] = trimmed.split("-", 2);
			const start = parseInt(startStr, 10);
			const end = parseInt(endStr, 10);
			if (!isNaN(start) && !isNaN(end) && end >= start) {
				for (let i = start; i <= end; i++) result.add(i);
			}
		} else {
			const n = parseInt(trimmed, 10);
			if (!isNaN(n)) result.add(n);
		}
	}
	return result;
}
