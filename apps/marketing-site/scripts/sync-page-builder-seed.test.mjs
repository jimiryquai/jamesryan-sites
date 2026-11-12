import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as pageBuilder from 'emdash-plugin-page-builder/blocks';
import { getOfferedBlocks } from '../src/components/page-builder/offered-blocks.mjs';
import { syncPageBuilderSeed } from './sync-page-builder-seed.mjs';

/** The ten block types this site offers on pages.layout (ticket 20). */
const offeredSlugs = ['hero', 'cta', 'features', 'testimonials', 'pricing', 'comparison', 'team', 'faq', 'stats', 'prose'];

test('offers exactly the ten package block types, each the package module itself', () => {
  const offered = getOfferedBlocks();
  assert.deepEqual(offered.map((block) => block.definition.slug), offeredSlugs);
  const exported = Object.values(pageBuilder).filter((value) => pageBuilder.isBlockType(value));
  assert.ok(offered.length <= exported.length);
  for (const block of offered) {
    assert.ok(exported.includes(block), `${block.definition.slug} is not exported by the installed package`);
  }
});

test('a fresh seed registers exactly the offered blocks on pages.layout', () => {
  const result = syncPageBuilderSeed({ check: true });
  assert.deepEqual(result.errors, [], 'Seed differs from the offered blocks; run node apps/marketing-site/scripts/sync-page-builder-seed.mjs');
  assert.deepEqual(result.blockTypes, offeredSlugs);
  const seed = JSON.parse(readFileSync(new URL('../seed/seed.json', import.meta.url), 'utf8'));
  assert.deepEqual(seed.blockTypes.map((block) => block.slug), offeredSlugs);
  assert.deepEqual(
    seed.blockTypes,
    getOfferedBlocks().map((block) => block.definition),
  );
  const layout = seed.collections
    .find((collection) => collection.slug === 'pages')
    .fields.find((field) => field.slug === 'layout');
  assert.deepEqual(layout.validation.allowedTypes, offeredSlugs);
});
