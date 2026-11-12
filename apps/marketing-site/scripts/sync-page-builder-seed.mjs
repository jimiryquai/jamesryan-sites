import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { getOfferedBlocks } from '../src/components/page-builder/offered-blocks.mjs';

/** The package owns definitions; this seed copy bootstraps fresh databases. */
export function syncPageBuilderSeed({ check = false } = {}) {
  const path = new URL('../seed/seed.json', import.meta.url);
  const original = readFileSync(path, 'utf8');
  const seed = JSON.parse(original);
  const blocks = getOfferedBlocks();
  seed.blockTypes = blocks.map((block) => block.definition);
  seed.collections.find((collection) => collection.slug === 'pages').fields
    .find((field) => field.slug === 'layout').validation.allowedTypes = blocks.map((block) => block.definition.slug);
  const updated = JSON.stringify(seed, null, 2) + '\n';
  if (check && original !== updated) {
    return { errors: [{ message: 'Seed differs from package definitions; run node apps/marketing-site/scripts/sync-page-builder-seed.mjs' }] };
  }
  if (!check && original !== updated) writeFileSync(path, updated);
  return { errors: [], updated: !check && original !== updated, blockTypes: blocks.map((block) => block.definition.slug) };
}

export function main(argv, out = console.log) {
  try {
    const { values } = parseArgs({ args: argv, options: { check: { type: 'boolean' } } });
    const result = syncPageBuilderSeed({ check: values.check });
    out(JSON.stringify(result));
    return result.errors.length ? 1 : 0;
  } catch (error) {
    out(JSON.stringify({ errors: [{ message: error.message }] }));
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
