import { getEmDashCollection, getEmDashEntry } from 'emdash';
import type { InferCollectionData } from 'emdash';
import {
  createFaqSource, createPricingSource, createTeamSource, createTestimonialsSource,
  mergeCacheHints, type Faq as FaqShape, type PricingTier, type QueryApi, type QueryListResult,
  type TeamMember as TeamMemberShape, type Testimonial as TestimonialShape,
} from 'emdash-plugin-page-builder/blocks';
import type { Faq, Pricing, Team, Testimonial } from '../../../emdash-env';

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

/** The collections the page builder may read, each with its shape mapping. */
const shapeByCollection = {
  pricing: pricingShape,
  testimonials: testimonialShape,
  faqs: faqShape,
  team: teamShape,
} as const;

type ListFilter = Parameters<QueryApi['list']>[1];

async function listShaped<C extends keyof typeof shapeByCollection & string, S extends object>(
  collection: C, filter: ListFilter | undefined, shape: (data: InferCollectionData<C>) => S,
): Promise<QueryListResult> {
  const result = await getEmDashCollection(collection, filter);
  if (result.error) throw result.error;
  // The package's query boundary carries data as a record; the shape functions
  // keep their typed results until this one boundary.
  return { ...result, entries: result.entries.map((entry) => ({ ...entry, data: { ...entry.data, ...(shape(entry.data) as Record<string, unknown>) } })) };
}

const siteQuery: QueryApi = {
  async list(collection, filter) {
    if (collection === 'pricing') return listShaped('pricing', filter, pricingShape);
    if (collection === 'testimonials') return listShaped('testimonials', filter, testimonialShape);
    if (collection === 'faqs') return listShaped('faqs', filter, faqShape);
    if (collection === 'team') return listShaped('team', filter, teamShape);
    throw new Error(`Unsupported page builder collection: ${collection}`);
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
export function createSources(query: QueryApi) {
  return {
    pricing: createPricingSource({ groupField: 'service', query }),
    testimonials: createTestimonialsSource({ groupField: 'service', query }),
    faq: createFaqSource({ groupField: 'service', query }),
    team: createTeamSource({ groupField: 'service', query }),
  };
}
export const sources = createSources(siteQuery);
