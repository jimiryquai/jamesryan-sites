import { getEmDashCollection, getEmDashEntry } from 'emdash';
import { createPricingSource, createTestimonialsSource, mergeCacheHints, type QueryApi } from 'emdash-plugin-page-builder/blocks';
import type { Pricing, Testimonial } from '../../../emdash-env';
import type { PricingTier, Testimonial as TestimonialShape } from 'emdash-plugin-page-builder/blocks';

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
const query: QueryApi = {
  async list(collection, filter) {
    if (collection === 'pricing') {
      const result = await getEmDashCollection('pricing', filter);
      if (result.error) throw result.error;
      return { ...result, entries: result.entries.map((entry) => ({ ...entry, data: { ...entry.data, ...pricingShape(entry.data) } })) };
    }
    if (collection === 'testimonials') {
      const result = await getEmDashCollection('testimonials', filter);
      if (result.error) throw result.error;
      return { ...result, entries: result.entries.map((entry) => ({ ...entry, data: { ...entry.data, ...testimonialShape(entry.data) } })) };
    }
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
export const sources = {
  pricing: createPricingSource({ groupField: 'service', query }),
  testimonials: createTestimonialsSource({ groupField: 'service', query }),
};
