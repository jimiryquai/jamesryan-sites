import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSources } from '../src/components/page-builder/sources.ts';

/** A fake QueryApi over fixed entries, recording every call it receives. */
function fakeQuery(collections) {
  const calls = { list: [], get: [] };
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
