import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWithContext } from 'emdash';
import { createSources } from '../src/components/page-builder/sources.ts';

/** A fake site query over fixed entries, recording every call it receives. */
function fakeQuery(collections) {
  const calls = { list: [], get: [], terms: [] };
  const query = {
    async list(collection, filter) {
      calls.list.push({ collection, filter });
      return { entries: collections[collection] ?? [], cacheHint: { tags: [`list-${collection}`] } };
    },
    async get(collection, id, options) {
      calls.get.push({ collection, id, options });
      const entry = (collections[collection] ?? []).find((candidate) => candidate.id === id);
      return { entry: entry ?? null, cacheHint: { tags: [`get-${collection}-${id}`] } };
    },
    async terms(collection, entryIds, taxonomy) {
      calls.terms.push({ collection, entryIds, taxonomy });
      return new Map((collections.terms?.[taxonomy] ?? []).filter(([id]) => entryIds.includes(id)));
    },
  };
  return { query, calls };
}

// The site's faqs/team entries carry the group as a resolved service reference,
// the shape the page builder's group matching reads.
const member = (id, data, service) => ({
  id,
  data,
  references: service ? { service: { entries: [{ id: service, data: { id: service } }] } } : {},
});

const collections = {
  faqs: [
    member('faq-in', { question: 'Do you offer support?', answer: 'Yes, on every plan.' }, 'svc-design'),
    member('faq-out', { question: 'Unrelated?', answer: 'Another service.' }, 'svc-other'),
    member('faq-free', { question: 'No service?', answer: 'Ungrouped.' }),
  ],
  team: [
    member('member-in', { name: 'James Ryan', role: 'Founder', image: { id: 'm1', src: '/m1.jpg' } }, 'svc-design'),
    member('member-out', { name: 'Someone Else', role: 'Elsewhere' }, 'svc-other'),
  ],
};

test('faq source reads the faqs collection scoped by the page service group', async () => {
  const { query, calls } = fakeQuery(structuredClone(collections));
  const result = await createSources(query).faq({ scope: 'page', group: 'svc-design' });
  assert.ok(calls.list.some((call) => call.collection === 'faqs'), 'faq source must list the faqs collection');
  assert.ok(
    calls.get.every((call) => call.collection === 'faqs' && call.options?.references?.service === true),
    'group matching must resolve the service reference on every faq',
  );
  assert.deepEqual([...result.items], [{ question: 'Do you offer support?', answer: 'Yes, on every plan.' }]);
});

test('team source reads the team collection scoped by the page service group', async () => {
  const { query, calls } = fakeQuery(structuredClone(collections));
  const result = await createSources(query).team({ scope: 'page', group: 'svc-design' });
  assert.ok(calls.list.some((call) => call.collection === 'team'), 'team source must list the team collection');
  assert.ok(
    calls.get.every((call) => call.collection === 'team' && call.options?.references?.service === true),
    'group matching must resolve the service reference on every member',
  );
  assert.deepEqual([...result.items], [
    { name: 'James Ryan', role: 'Founder', image: { id: 'm1', src: '/m1.jpg' } },
  ]);
});

// The site's posts entries: tags arrive through a separate terms read, bylines
// ride on the entry data, and the reading time comes from the Portable Text.
const postWords = (count) => [{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: Array.from({ length: count }, () => 'word').join(' ') }] }];
const postCollections = {
  posts: [
    {
      id: 'newest-post',
      data: {
        id: 'ulid-newest', title: 'Newest Post', excerpt: 'The lead.',
        publishedAt: new Date('2026-11-01T09:00:00.000Z'),
        featured_image: { id: 'img-1', src: '/img/newest.webp', alt: 'Cover' },
        content: postWords(210),
        bylines: [{ byline: { displayName: 'James Ryan', avatarMediaId: 'avatar-1' } }],
      },
    },
    {
      id: 'older-post',
      data: { id: 'ulid-older', title: 'Older Post', publishedAt: new Date('2026-10-01T09:00:00.000Z'), content: postWords(10) },
    },
  ],
  terms: { tag: [['ulid-newest', [{ slug: 'automation', label: 'Automation' }, { slug: 'power-platform', label: 'Power Platform' }]]] },
};

test('posts source reads the posts collection newest first with the resolved count and the category filter', async () => {
  const { query, calls } = fakeQuery(structuredClone(postCollections));
  const result = await createSources(query).posts({ scope: 'all', count: 3, category: 'engineering' });
  assert.deepEqual(calls.list.filter((call) => call.collection === 'posts').map((call) => call.filter), [
    { limit: 3, where: { category: 'engineering' }, orderBy: { published_at: 'desc' } },
  ]);
  assert.deepEqual(calls.terms, [{ collection: 'posts', entryIds: ['ulid-newest', 'ulid-older'], taxonomy: 'tag' }]);
  assert.deepEqual(result.cacheHints, [{ tags: ['list-posts'] }]);
});

test('posts source defaults an absent count to the posts block default of 4', async () => {
  const { query, calls } = fakeQuery(structuredClone(postCollections));
  await createSources(query).posts({ scope: 'all' });
  assert.equal(
    calls.list.find((call) => call.collection === 'posts').filter.limit, 4,
    'an absent count must fall back to the block definition default',
  );
});

test('posts source maps each entry with url, tags, bylines, reading time, date, excerpt and image', async () => {
  const { query } = fakeQuery(structuredClone(postCollections));
  const result = await createSources(query).posts({ scope: 'all' });
  assert.deepEqual([...result.items], [
    {
      title: 'Newest Post',
      url: '/posts/newest-post',
      excerpt: 'The lead.',
      date: new Date('2026-11-01T09:00:00.000Z'),
      image: { id: 'img-1', src: '/img/newest.webp', alt: 'Cover' },
      tags: [{ slug: 'automation', label: 'Automation' }, { slug: 'power-platform', label: 'Power Platform' }],
      bylines: [{ byline: { displayName: 'James Ryan', avatarMediaId: 'avatar-1' } }],
      readingTime: 2,
    },
    { title: 'Older Post', url: '/posts/older-post', date: new Date('2026-10-01T09:00:00.000Z'), readingTime: 1 },
  ]);
});

test('posts source shares one read per request for an identical context and reads fresh outside one', async () => {
  const { query, calls } = fakeQuery(structuredClone(postCollections));
  const posts = createSources(query).posts;
  const listCalls = () => calls.list.filter((call) => call.collection === 'posts').length;
  await runWithContext({ editMode: false }, async () => {
    const [first, second] = await Promise.all([posts({ scope: 'all' }), posts({ scope: 'all' })]);
    assert.equal(first, second, 'concurrent identical reads must share one result object');
    await posts({ scope: 'all' });
    assert.equal(listCalls(), 1, 'repeat reads in one request must share the first read');
    await posts({ scope: 'all', count: 2 });
    assert.equal(listCalls(), 2, 'a different context reads separately');
  });
  await posts({ scope: 'all' });
  assert.equal(listCalls(), 3, 'outside a request context every read goes to the query');
});

test('both sources pass the cache hints of everything they read on to the page', async () => {
  const { query } = fakeQuery(structuredClone(collections));
  const faq = await createSources(query).faq({ scope: 'page', group: 'svc-design' });
  assert.deepEqual(faq.cacheHints, [
    { tags: ['list-faqs'] },
    { tags: ['get-faqs-faq-in'] },
    { tags: ['get-faqs-faq-out'] },
    { tags: ['get-faqs-faq-free'] },
  ]);
  const team = await createSources(query).team({ scope: 'page', group: 'svc-design', count: 1 });
  assert.deepEqual([...team.items], [{ name: 'James Ryan', role: 'Founder', image: { id: 'm1', src: '/m1.jpg' } }]);
  assert.ok(team.cacheHints.length >= 2, 'team cache hints must include the list and get hints');
});
