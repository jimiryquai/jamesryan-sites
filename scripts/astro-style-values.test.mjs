import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { relative, join } from 'node:path';

// Browsers drop declarations like `background: var(--color-olive-950)/2.5` or
// `border-color: white/5` as invalid: the Tailwind slash-alpha shorthand only
// exists inside utility class values, never in raw CSS inside <style> blocks.
const ALPHA_SHORTHAND = [
  /var\([^)]*\)\s*\/\s*[\d.]+/,
  /(?<![\w-])(?:white|black)\s*\/\s*[\d.]+/,
];

async function astroFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.wrangler', '.astro'].includes(entry.name)) return [];
      return astroFiles(join(directory, entry.name));
    }
    return entry.name.endsWith('.astro') ? [join(directory, entry.name)] : [];
  }));
  return files.flat();
}

function styleBlockInvalidDeclarations(source, fileName) {
  const offences = [];
  for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const block = match[1];
    for (const [lineIndex, line] of block.split('\n').entries()) {
      for (const pattern of ALPHA_SHORTHAND) {
        if (pattern.test(line)) {
          offences.push(`${fileName}:<style> line ${lineIndex + 1}: ${line.trim()}`);
        }
      }
    }
  }
  return offences;
}

test('astro style blocks contain no raw Tailwind slash-alpha values', async () => {
  const files = [...await astroFiles('apps'), ...await astroFiles('packages')];
  assert.ok(files.length > 10, `expected to scan the repo's astro files, found ${files.length}`);
  const offences = [];
  for (const file of files) {
    offences.push(...styleBlockInvalidDeclarations(await readFile(file, 'utf8'), relative('.', file)));
  }
  assert.deepEqual(offences, []);
});
