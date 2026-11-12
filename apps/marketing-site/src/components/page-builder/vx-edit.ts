// THROWAWAY SPIKE (ticket 25): visual-editor markers for page-builder blocks.
// Mirrors upstream's src/sections/_shared/edit.ts (emdash-visual-editor @08a5e75, MIT):
// block roots get data-vx-key/data-vx-label, editable text leaves get
// data-vx-f="<blockKey>.<field>" — and only inside the visual editor's
// authenticated draft preview (Astro.locals.vxFrame, set by PublishedPage.astro
// from EmDash's *verified* preview context, never from query presence alone).
// Public pages get neither. Nothing here merges.
import OFFERED from './offered-blocks.json';

export interface VxBlock {
	_key?: string;
	_type?: string;
}

const LABELS: Record<string, string> = Object.fromEntries(
	// offered-blocks.json is the slug list; labels come from the seed's block
	// types, but the editor only needs a hover label, so the slug suffices.
	OFFERED.map((slug: string) => [slug, slug.replace(/(^|-)(\w)/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase())]),
);

function inFrame(locals: unknown): boolean {
	return (locals as { vxFrame?: boolean } | null | undefined)?.vxFrame === true;
}

/** Section-root attributes for the visual editor frame. */
export function veSection(locals: unknown, block: VxBlock): Record<string, string> {
	if (!inFrame(locals) || !block?._key) return {};
	return { 'data-vx-key': block._key, 'data-vx-label': LABELS[block._type ?? ''] || block._type || 'Block' };
}

/** Field marker for a text leaf: data-vx-f="<blockKey>.<field>". */
export function ed(locals: unknown, block: VxBlock, field: string): Record<string, string> {
	if (!inFrame(locals) || !block?._key || !field) return {};
	return { 'data-vx-f': `${block._key}.${field}` };
}
