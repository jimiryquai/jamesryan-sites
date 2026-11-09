import offeredSlugs from './offered-blocks.json' with { type: 'json' };
import * as blockExports from 'emdash-plugin-page-builder/blocks';

/**
 * Resolve this site's selection without offering newly exported package types.
 * @returns {import('emdash-plugin-page-builder/blocks').BlockType[]}
 */
export function getOfferedBlocks() {
  if (!offeredSlugs.length || new Set(offeredSlugs).size !== offeredSlugs.length) {
    throw new Error('Offered block slugs must be a non-empty list without duplicates');
  }
  /**
   * @param {unknown} value
   * @returns {value is import('emdash-plugin-page-builder/blocks').BlockType}
   */
  const isBlock = (value) => Boolean(value && typeof value === 'object' && 'definition' in value && 'variants' in value && 'migrations' in value);
  /** @type {unknown[]} */
  const values = Object.values(blockExports);
  const available = values.filter(isBlock);
  return offeredSlugs.map((slug) => {
    const block = available.find((candidate) => candidate.definition.slug === slug);
    if (!block) throw new Error(`Offered block "${slug}" is not exported by the installed page builder`);
    return block;
  });
}
