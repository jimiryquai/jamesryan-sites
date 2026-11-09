import { readFileSync, writeFileSync } from 'node:fs';
import * as blockExports from 'emdash-plugin-page-builder/blocks';

// The package owns definitions; this seed copy bootstraps fresh databases.
const path = new URL('../seed/seed.json', import.meta.url);
const original = readFileSync(path, 'utf8');
const seed = JSON.parse(original);
const blocks = Object.values(blockExports).filter((value) => value?.definition && value?.variants && value?.migrations);
seed.blockTypes = blocks.map((block) => block.definition);
seed.collections.find((collection) => collection.slug === 'pages').fields
  .find((field) => field.slug === 'layout').validation.allowedTypes = blocks.map((block) => block.definition.slug);
const updated = JSON.stringify(seed, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (original !== updated) {
    console.log(JSON.stringify({ errors: [{ message: 'Seed differs from package definitions; run node apps/marketing-site/scripts/sync-page-builder-seed.mjs' }] }));
    process.exitCode = 1;
  } else console.log(JSON.stringify({ errors: [], blockTypes: blocks.map((block) => block.definition.slug) }));
} else {
  writeFileSync(path, updated);
  console.log(JSON.stringify({ updated: 'seed/seed.json', blockTypes: blocks.map((block) => block.definition.slug) }));
}
