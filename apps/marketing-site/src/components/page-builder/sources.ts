import { getEmDashCollection, getEmDashEntry, getTermsForEntries, getRequestContext } from 'emdash';
import type { ContentBylineCredit, InferCollectionData, TaxonomyTerm } from 'emdash';
import {
  createFaqSource, createPricingSource, createPostsSource, createTeamSource, createTestimonialsSource,
  mergeCacheHints, POST_TAG_TAXONOMY,
  type Faq as FaqShape, type Post, type PostByline, type PostEntry, type PostTag, type PricingTier,
  type QueryApi, type QueryListResult, type Source, type SourceContext, type SourceResult,
  type TeamMember as TeamMemberShape, type Testimonial as TestimonialShape,
} from 'emdash-plugin-page-builder/blocks';
import { getReadingTime } from '@jamesryan/cms-helpers/reading-time';
import type { Faq, Pricing, Post as PostRow, Team, Testimonial } from '../../../emdash-env';

// These assignments make collection/shape drift a type error in this site.
const pricingShape = (data: Pricing): PricingTier => ({
  name: data.name, price: data.price, price_monthly: data.price_monthly ?? undefined,
  price_yearly: data.price_yearly ?? undefined, period: data.period ?? undefined, description: data.description ?? undefined,
  features: data.features ?? undefined, cta_label: data.cta_label ?? undefined, cta_url: data.cta_url ?? undefined,
  badge: data.badge ?? undefined, highlighted: data.highlighted ?? undefined,
});
const testimonialShape = (data: Testimonial): TestimonialShape => ({
  quote: data.quote, author: data.author, role: data.role ?? undefined, company: data.company ?? undefined, avatar: data.avatar ?? undefined,
});
const faqShape = (data: Faq): FaqShape => ({ question: data.question, answer: data.answer });
const teamShape = (data: Team): TeamMemberShape => ({ name: data.name, role: data.role, image: data.image ?? undefined });

/** The collections the page builder may read from this site. */
type ShapeCollection = 'pricing' | 'testimonials' | 'faqs' | 'team' | 'posts';

type ListFilter = Parameters<QueryApi['list']>[1];

async function rawList(collection: ShapeCollection, filter: ListFilter | undefined): Promise<QueryListResult> {
  const result = await getEmDashCollection(collection, filter);
  if (result.error) throw result.error;
  // The package's query boundary carries data as a record; the shape functions
  // keep their typed results until this one boundary.
  return result as unknown as QueryListResult;
}
async function listShaped<C extends ShapeCollection, S extends object>(
  collection: C, filter: ListFilter | undefined, shape: (data: InferCollectionData<C>) => S,
): Promise<QueryListResult> {
  const result = await getEmDashCollection(collection, filter);
  if (result.error) throw result.error;
  // The package's query boundary carries data as a record; the shape functions
  // keep their typed results until this one boundary.
  return { ...result, entries: result.entries.map((entry) => ({ ...entry, data: { ...entry.data, ...(shape(entry.data) as Record<string, unknown>) } })) };
}

/** One entry of a posts collection as the site stores it: the generated row plus taxonomy terms. */
type PostsEntryData = Partial<PostRow> & { terms?: Partial<Record<string, readonly TaxonomyTerm[]>> };

/** The Post the site's sections render: the package's shape plus the reading time. */
export interface SitePost extends Post {
  readingTime: number;
}

const isBylineCredit = (value: unknown): value is PostByline =>
  typeof value === 'object' && value !== null &&
  typeof (value as PostByline).byline?.displayName === 'string';

/** The posts row a list returns, decorated with its tag terms so one shape mapper covers it. */
function mapPost(entry: PostEntry): SitePost {
  const data = entry.data as PostsEntryData;
  const tags: PostTag[] = (data.terms?.[POST_TAG_TAXONOMY] ?? []).flatMap((term) =>
    typeof term.slug === 'string' && typeof term.label === 'string' ? [{ slug: term.slug, label: term.label }] : []);
  const bylines = (data.bylines ?? []).filter(isBylineCredit);
  const date = data.publishedAt ?? undefined;
  const image = typeof data.featured_image === 'object' && data.featured_image !== null ? data.featured_image : undefined;
  return {
    title: String(data.title ?? ''),
    url: `/posts/${entry.id}`,
    ...(typeof data.excerpt === 'string' && data.excerpt.length > 0 ? { excerpt: data.excerpt } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(image !== undefined ? { image } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(bylines.length > 0 ? { bylines } : {}),
    readingTime: getReadingTime(data.content),
  };
}

/** The sections render bylines through EmDash's credit shape; the site's
 * source passes the collection's credits through unchanged. */
export function cardBylines(post: SitePost): ContentBylineCredit[] | undefined {
  return post.bylines as ContentBylineCredit[] | undefined;
}

/** List the posts collection and fold each entry's tag terms into its data, so
 * the posts source maps tags without a second query layer. */
async function listPostsWithTags(
  query: SiteQuery, filter: ListFilter | undefined,
): Promise<QueryListResult> {
  const result = await query.list('posts', filter);
  if (result.error) throw result.error;
  const ids = result.entries.map((entry) => String(entry.data.id));
  const tagsByEntry = ids.length ? await query.terms('posts', ids, POST_TAG_TAXONOMY) : new Map<string, TaxonomyTerm[]>();
  const entries = result.entries.map((entry) => {
    const data = entry.data as PostsEntryData;
    return { ...entry, data: { ...data, terms: { ...data.terms, tag: tagsByEntry.get(String(data.id)) ?? [] } } };
  });
  // The package's query boundary carries data as a record; the shapes stay typed above it.
  return { ...result, entries: entries as unknown as QueryListResult['entries'] };
}

/** A stable key for a source context, so memoized reads only collide on equal contexts. */
function contextKey(context: SourceContext): string {
  const sorted = (value: unknown): unknown =>
    value !== null && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, item]) => [key, sorted(item)]))
      : value;
  return JSON.stringify(sorted(context));
}

/** Share one read per request for one context: the home route's featured-image
 * preload and the rendered section must not query posts twice on `/`. Outside a
 * request (builds, tests) every call reads afresh. */
export function perRequestSource<T>(source: Source<T>): Source<T> {
  const reads = new WeakMap<object, Map<string, Promise<SourceResult<T> | readonly T[]>>>();
  return async (context) => {
    const request = getRequestContext();
    if (!request) return source(context);
    let byKey = reads.get(request);
    if (!byKey) {
      byKey = new Map();
      reads.set(request, byKey);
    }
    const key = contextKey(context);
    const cached = byKey.get(key);
    if (cached) return cached;
    const read = Promise.resolve(source(context));
    byKey.set(key, read);
    return read;
  };
}

/** The reads the site's posts source makes beyond the query API: per-entry terms. */
export interface TermsQuery {
  terms(collection: string, entryIds: string[], taxonomy: string): Promise<Map<string, TaxonomyTerm[]>>;
}

/** The query boundary the site wires: collections and terms, injectable for tests. */
export type SiteQuery = QueryApi & TermsQuery;

const siteQuery: SiteQuery = {
  async list(collection, filter) {
    if (collection === 'posts') return rawList('posts', filter);
    if (collection === 'pricing') return listShaped('pricing', filter, pricingShape);
    if (collection === 'testimonials') return listShaped('testimonials', filter, testimonialShape);
    if (collection === 'faqs') return listShaped('faqs', filter, faqShape);
    if (collection === 'team') return listShaped('team', filter, teamShape);
    throw new Error(`Unsupported page builder collection: ${collection}`);
  },
  terms(collection, entryIds, taxonomy) {
    return getTermsForEntries(collection, entryIds, taxonomy);
  },
  async get(collection, id, options) {
    const result = await getEmDashEntry(collection, id, options);
    if (result.error) throw result.error;
    const entry = result.entry;
    // The existing seed's service-select widget stores a scalar ID. Bound
    // references already resolve above; expose legacy selections at the same seam.
    const service = entry?.data.service;
    if (!entry || entry.references?.service || typeof service !== 'string' || !service) return result;
    const target = await getEmDashEntry('services', service);
    if (target.error) throw target.error;
    return {
      ...result,
      cacheHint: mergeCacheHints([result.cacheHint, target.cacheHint]),
      entry: { ...entry, references: { ...entry.references, service: { entries: target.entry ? [{ ...target.entry, data: { ...target.entry.data } }] : [] } } },
    };
  },
};

/**
 * Wire the shared-content blocks to this site's collections, grouped by the
 * page's `service`. `query` is injectable so tests exercise the wiring
 * without a database (CODING_STANDARDS rule 7).
 */
export function createSources(query: SiteQuery) {
  return {
    pricing: createPricingSource({ groupField: 'service', query }),
    testimonials: createTestimonialsSource({ groupField: 'service', query }),
    faq: createFaqSource({ groupField: 'service', query }),
    team: createTeamSource({ groupField: 'service', query }),
    posts: perRequestSource(createPostsSource({ query: { list: (_collection, filter) => listPostsWithTags(query, filter) }, mapEntry: mapPost })),
  };
}
export const sources = createSources(siteQuery);
