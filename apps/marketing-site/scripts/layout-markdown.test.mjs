import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLayoutMarkdown } from '../src/components/page-builder/layout-markdown.ts';

/**
 * Fake sources in the shape sources.ts exports, recording every call so the
 * tests can assert exactly what the Markdown route asks of each block's source
 * (CODING_STANDARDS rule 7).
 */
function fakeSources(overrides = {}) {
  const calls = [];
  const recorder = (slug) => async (context) => {
    calls.push({ slug, context });
    return overrides[slug] ?? [];
  };
  return {
    sources: { pricing: recorder('pricing'), testimonials: recorder('testimonials'), faq: recorder('faq'), team: recorder('team'), posts: recorder('posts') },
    calls,
  };
}

const hero = {
  _type: 'hero', _key: 'hero', _version: 1, variant: 'centered',
  heading: 'Ship pages from blocks', body: 'One layout, many consumers.',
  links: [{ label: 'Read the blog', url: '/posts' }],
};

test('an inline block renders through the package with its heading, body and links', async () => {
  const { markdown, cacheHints } = await renderLayoutMarkdown([hero], undefined);
  assert.match(markdown, /# Ship pages from blocks/);
  assert.match(markdown, /One layout, many consumers\./);
  assert.match(markdown, /- \[Read the blog\]\(\/posts\)/);
  assert.deepEqual(cacheHints, []);
});

test('a shared-content block passes its items keyed by block key into the markdown', async () => {
  const { sources } = fakeSources({
    faq: [{ question: 'Do you offer support?', answer: 'Yes, on every plan.' }],
  });
  const { markdown } = await renderLayoutMarkdown(
    [{ _type: 'faq', _key: 'page-faq', _version: 1, variant: 'two-column', scope: 'all' }],
    undefined,
    sources,
  );
  assert.match(markdown, /## FAQ/);
  assert.match(markdown, /### Do you offer support\?/);
  assert.match(markdown, /Yes, on every plan\./);
});

test('scope page without a group reads as scope all, with no group passed', async () => {
  const { sources, calls } = fakeSources({ faq: [] });
  await renderLayoutMarkdown(
    [{ _type: 'faq', _key: 'page-faq', _version: 1, scope: 'page' }],
    undefined,
    sources,
  );
  assert.deepEqual(calls, [{ slug: 'faq', context: { scope: 'all', group: undefined, count: undefined } }]);
});

test('scope page with a group passes the page group and a positive count through', async () => {
  const { sources, calls } = fakeSources({ team: [{ name: 'James Ryan', role: 'Founder' }] });
  const { markdown } = await renderLayoutMarkdown(
    [{ _type: 'team', _key: 'page-team', _version: 1, scope: 'page', count: 2 }],
    'svc-design',
    sources,
  );
  assert.deepEqual(calls, [{ slug: 'team', context: { scope: 'page', group: 'svc-design', count: 2 } }]);
  assert.match(markdown, /- \*\*James Ryan\*\* — Founder/);
});

test('a stored count that is not a positive number is not passed on', async () => {
  const { sources, calls } = fakeSources();
  await renderLayoutMarkdown(
    [{ _type: 'team', _key: 'page-team', _version: 1, scope: 'all', count: 0 }],
    undefined,
    sources,
  );
  assert.equal(calls[0].context.count, undefined);
});

test('blocks without a source render inline content only', async () => {
  const { sources, calls } = fakeSources();
  const { markdown } = await renderLayoutMarkdown([hero], undefined, sources);
  assert.deepEqual(calls, []);
  assert.match(markdown, /# Ship pages from blocks/);
});

test('each source is asked once per block, keyed by that block, not by type', async () => {
  const { sources, calls } = fakeSources({
    team: [{ name: 'James Ryan', role: 'Founder' }],
  });
  const { markdown } = await renderLayoutMarkdown(
    [
      { _type: 'team', _key: 'team-a', _version: 1, scope: 'all' },
      { _type: 'team', _key: 'team-b', _version: 1, scope: 'all' },
    ],
    undefined,
    sources,
  );
  assert.equal(calls.length, 2);
  assert.equal((markdown.match(/- \*\*James Ryan\*\* — Founder/g) ?? []).length, 2);
});

test('source cache hints are preserved for the route to apply', async () => {
  const sources = {
    faq: async () => ({ items: [{ question: 'Q?', answer: 'A.' }], cacheHints: [{ tags: ['faqs-list'] }] }),
    team: async () => ({ items: [], cacheHints: [{ tags: ['team-list'] }, { tags: ['team-get-1'] }] }),
  };
  const { markdown, cacheHints } = await renderLayoutMarkdown(
    [
      { _type: 'faq', _key: 'page-faq', _version: 1, scope: 'all' },
      { _type: 'team', _key: 'page-team', _version: 1, scope: 'all' },
    ],
    undefined,
    sources,
  );
  assert.match(markdown, /### Q\?/);
  assert.deepEqual(cacheHints, [{ tags: ['faqs-list'] }, { tags: ['team-list'] }, { tags: ['team-get-1'] }]);
});

test('a posts block defaults its absent count to 4 and passes its trimmed category through', async () => {
  const { sources, calls } = fakeSources({ posts: [{ title: 'Newest', url: '/posts/newest' }] });
  const { markdown } = await renderLayoutMarkdown(
    [
      { _type: 'posts', _key: 'home-posts', _version: 1, variant: 'featured-grid', category: ' engineering ' },
      { _type: 'posts', _key: 'other-posts', _version: 1, variant: 'grid', count: 6 },
    ],
    undefined,
    sources,
  );
  assert.deepEqual(calls.map((call) => [call.slug, call.context]), [
    ['posts', { scope: 'all', group: undefined, count: 4, category: 'engineering' }],
    ['posts', { scope: 'all', group: undefined, count: 6 }],
  ]);
  assert.equal((markdown.match(/- \[Newest\]\(\/posts\/newest\)/g) ?? []).length, 2);
});

test('a posts block heading renders and an item without a URL is skipped', async () => {
  const { sources } = fakeSources({ posts: [{ title: 'Newest', url: '/posts/newest' }, { title: 'No URL' }] });
  const { markdown } = await renderLayoutMarkdown(
    [{ _type: 'posts', _key: 'home-posts', _version: 1, heading: 'From the blog' }],
    undefined,
    sources,
  );
  assert.match(markdown, /## From the blog/);
  assert.doesNotMatch(markdown, /No URL/);
});

test('source results carrying cache hints still yield their items', async () => {
  const sources = {
    faq: async () => ({ items: [{ question: 'Q?', answer: 'A.' }], cacheHints: [{ tags: ['faqs'] }] }),
  };
  const { markdown } = await renderLayoutMarkdown(
    [{ _type: 'faq', _key: 'page-faq', _version: 1, scope: 'all' }],
    undefined,
    sources,
  );
  assert.match(markdown, /### Q\?/);
});
