import {
  isSourceResult, layoutToMarkdown, migrateBlocks, resolveSourceContext,
  type BlockType, type Source, type StoredBlock,
} from 'emdash-plugin-page-builder/blocks';
import type { CacheHint } from 'emdash';
import type { Page } from '../../../emdash-env';
import { getOfferedBlocks } from './offered-blocks.mjs';

/** A page's layout as Markdown, plus everything its sources read to render it. */
export interface RenderedLayoutMarkdown {
  markdown: string;
  /** The cache hints of every query the shared-content sources made, in block
   * order, for the route to fold into its own cache hint. */
  cacheHints: readonly CacheHint[];
}

/**
 * What each shared-content block's source read, keyed by that block's `_key`:
 * the items map `layoutToMarkdown` renders alongside each block. Resolves the
 * source context exactly as `PageBuilder` renders it — scope and group, the
 * schema-derived count default, and block-specific context such as `posts`
 * category — so the Markdown route serves the same items the page shows
 * without a second query per block.
 */
async function collectLayoutSourceItems(
  layout: readonly StoredBlock[], group: string | undefined, sources: Readonly<Record<string, Source>>,
): Promise<{ items: Record<string, readonly unknown[]>; cacheHints: CacheHint[] }> {
  const items: Record<string, readonly unknown[]> = {};
  const cacheHints: CacheHint[] = [];
  const blockTypes: BlockType[] = getOfferedBlocks();
  const bySlug = new Map(blockTypes.map((blockType) => [blockType.definition.slug, blockType]));
  for (const block of migrateBlocks([...layout], blockTypes)) {
    const source = sources[block._type];
    if (!source) continue;
    const result = await source(resolveSourceContext(block, bySlug.get(block._type), group));
    const read = isSourceResult(result) ? result : { items: result };
    if (read.cacheHints) cacheHints.push(...read.cacheHints);
    items[block._key] = read.items;
  }
  return { items, cacheHints };
}

/** A page's layout as plain Markdown, with its shared-content blocks' items. */
export async function renderLayoutMarkdown(
  layout: NonNullable<Page['layout']>, group: string | undefined, sources: Readonly<Record<string, Source>> = {},
): Promise<RenderedLayoutMarkdown> {
  // Generated block interfaces omit the generic renderer's string index signature.
  const stored: StoredBlock[] = layout.map((block) => ({ ...block }));
  const { items, cacheHints } = await collectLayoutSourceItems(stored, group, sources);
  return { markdown: layoutToMarkdown(stored, getOfferedBlocks(), { items }), cacheHints };
}
