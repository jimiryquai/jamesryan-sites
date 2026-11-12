import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve, join } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

// Browsers drop declarations like `background: var(--color-olive-950)/2.5`,
// `border-color: white/5` or `color: #fff/10` as invalid: the Tailwind
// slash-alpha shorthand only exists inside utility class values, never in raw
// CSS inside <style> blocks. `#white`-style hex typos are dropped the same way.

function maskFunctions(value) {
  // Collapse balanced function calls (repeatedly, for nesting) so slashes
  // inside calc()/rgb()/etc. cannot false-positive; keep a marker for var()
  // so `var(...)/N` right after the call stays detectable.
  const call = /\b(calc|rgba?|hsla?|oklch|oklab|lch|lab|color-mix|color|var|min|max|clamp)\((?:[^()]|\([^()]*\))*\)/g;
  let masked = value;
  let previous;
  do {
    previous = masked;
    masked = masked.replace(call, (match, name) => (name === 'var' ? '' : ''));
  } while (masked !== previous);
  return masked;
}

const INVALID_VALUE_PATTERNS = [
  [/\x01\s*\/\s*[\d.]+/, 'var(...) slash-alpha'],
  [/(?<![\w-])(?:white|black)\s*\/\s*[\d.]+/, 'named color slash-alpha'],
  [/#[0-9a-fA-F]{3,8}\s*\/\s*[\d.]+/, 'hex slash-alpha'],
  [/#(?:white|black|red|green|blue|orange|yellow|purple|pink|gray|grey|silver|gold|transparent|inherit|currentcolor)\b/i, 'named color after #'],
];

// Slash-alpha can only ever apply to paint; properties like font,
// aspect-ratio and grid-* use `/` legitimately.
const PAINT_PROPERTY = /^(?:-[a-z]+-)?(?:color|background|border|outline|fill|stroke|box-shadow|text-decoration|caret|column-rule|text-emphasis)/;

function declarationOffences(line) {
  const offences = [];
  // Declarations can start a line or follow `{` / `;` on an inline rule.
  for (const match of line.matchAll(/(?:^|[{;])\s*(-?[a-zA-Z][a-zA-Z-]*)\s*:\s*([^;{}]+)/g)) {
    const [, property, value] = match;
    if (!PAINT_PROPERTY.test(property)) continue;
    const masked = maskFunctions(value);
    for (const [pattern, label] of INVALID_VALUE_PATTERNS) if (pattern.test(masked)) offences.push(label);
  }
  return offences;
}

function stripCssComments(css) {
  // Blank the comment text but keep newlines so line numbers stay true.
  return css.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));
}

function styleBlockInvalidDeclarations(source, fileName) {
  const offences = [];
  for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const block = stripCssComments(match[1]);
    for (const [lineIndex, line] of block.split('\n').entries()) {
      for (const label of declarationOffences(line)) {
        offences.push(`${fileName}:<style> line ${lineIndex + 1}: ${label}: ${line.trim()}`);
      }
    }
  }
  return offences;
}

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

test('declarationOffences flags every raw slash-alpha and hex-typo shape', () => {
  const invalid = [
    'background: var(--color-olive-950)/2.5;',
    'border-color: white/10;',
    'color: #fff/10;',
    'background: var(--c, rgb(0,0,0))/5;',
    'color: #white !important;',
    'border-top: 1px solid var(--color-olive-950)/10;',
  ];
  for (const declaration of invalid) {
    assert.notDeepEqual(declarationOffences(declaration), [], declaration);
  }
});

test('declarationOffences leaves legitimate CSS slash syntax alone', () => {
  const valid = [
    'padding: calc(var(--spacing-xl) / 2);',
    'aspect-ratio: var(--w) / 1;',
    'grid-column: var(--start) / 3;',
    'font: var(--size) / 1.6 sans-serif;',
    'color: rgb(var(--c) / 0.1);',
    'background: color-mix(in srgb, var(--color-olive-950) 5%, transparent);',
    'border-color: var(--color-border);',
  ];
  for (const declaration of valid) {
    assert.deepEqual(declarationOffences(declaration), [], declaration);
  }
});

test('styleBlockInvalidDeclarations reports comments as clean and keeps line numbers', () => {
  const source = '<style>\n\t.a { color: red; }\n\t/* background: var(--x)/5 */\n\t.b { border-color: #fff/10; }\n</style>';
  const offences = styleBlockInvalidDeclarations(source, 'fixture.astro');
  assert.equal(offences.length, 1);
  assert.match(offences[0], /fixture\.astro:<style> line 4: hex slash-alpha/);
});

test('astro style blocks contain no raw Tailwind slash-alpha values', async () => {
  const files = [...await astroFiles(join(repoRoot, 'apps')), ...await astroFiles(join(repoRoot, 'packages'))];
  assert.ok(files.length > 10, `expected to scan the repo's astro files, found ${files.length}`);
  const offences = [];
  for (const file of files) {
    offences.push(...styleBlockInvalidDeclarations(await readFile(file, 'utf8'), relative(repoRoot, file)));
  }
  assert.deepEqual(offences, []);
});
