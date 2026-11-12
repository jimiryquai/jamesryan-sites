import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const skillPath = resolve(import.meta.dirname, '../.agents/skills/emdash-mcp/SKILL.md');

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, 'SKILL.md starts with a closing YAML frontmatter block');
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    assert.doesNotMatch(line, /^\s/, `frontmatter value stays on one line: ${line}`);
    const separator = line.indexOf(':');
    assert.ok(separator > 0, `frontmatter line has a key: ${line}`);
    const key = line.slice(0, separator).trim();
    assert.match(key, /^[A-Za-z][A-Za-z0-9_-]*$/, `frontmatter key is a plain identifier: ${key}`);
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    assert.equal(fields[key], undefined, `frontmatter key ${key} is unique`);
    assert.ok(value.length > 0, `frontmatter key ${key} has a value`);
    fields[key] = value;
  }
  assert.deepEqual(Object.keys(fields).sort(), ['description', 'name']);
  return fields;
}

test('emdash-mcp skill points agents at mcporter servers and the publishing docs', async () => {
  const markdown = await readFile(skillPath, 'utf8');
  const fields = parseFrontmatter(markdown);

  assert.equal(fields.name, 'emdash-mcp');
  assert.match(fields.description, /mcporter/);
  assert.match(fields.description, /draft/i);
  assert.doesNotMatch(fields.description, /publish,\s*or delete/i);

  assert.match(markdown, /docs\/mcp\.md/);
  assert.match(markdown, /docs\/publishing\.md/);
  assert.match(markdown, /emdash-site/);
  assert.match(markdown, /emdash-garden/);
  assert.match(markdown, /emdash-staging-agent/);
  assert.match(markdown, /pnpm -s mcp:local/);
  assert.match(markdown, /pnpm -s mcp:staging/);

  assert.doesNotMatch(markdown, /emdash-marketing/);
  assert.doesNotMatch(markdown, /Do not run[\s\S]{0,120}mcporter/i);
  assert.doesNotMatch(markdown, /do not (?:run |use )?[`']?mcporter/i);
  assert.doesNotMatch(markdown, /npx mcporter/);
});

test('emdash-mcp skill examples stay draft-only and use current schema names', async () => {
  const markdown = await readFile(skillPath, 'utf8');

  assert.match(markdown, /layout/);
  assert.match(markdown, /\bcategory\b/);
  assert.match(markdown, /\btag\b/);
  assert.match(markdown, /\/posts/);

  assert.doesNotMatch(markdown, /post_tag/);
  assert.doesNotMatch(markdown, /\/blog\b/);
  assert.doesNotMatch(markdown, /status:\s*["']published["']/);
  assert.doesNotMatch(markdown, /"content"\s*:/);
  assert.doesNotMatch(markdown, /content_delete/);
});
