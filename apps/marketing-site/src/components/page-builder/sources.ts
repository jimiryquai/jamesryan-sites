import { getEmDashCollection, getEmDashEntry } from 'emdash';
import { createPricingSource, createTestimonialsSource, type QueryApi } from 'emdash-plugin-page-builder/blocks';
import type { Pricing, Testimonial } from '../../../emdash-env';
import type { PricingTier, Testimonial as TestimonialShape } from 'emdash-plugin-page-builder/blocks';

// These assignments make collection/shape drift a type error in this site.
const pricingShape = (data: Pricing): PricingTier => ({
  name: data.name, price: data.price, price_monthly: data.price_monthly,
  price_yearly: data.price_yearly, period: data.period, description: data.description,
  features: data.features, cta_label: data.cta_label, cta_url: data.cta_url,
  badge: data.badge, highlighted: data.highlighted,
});
const testimonialShape = (data: Testimonial): TestimonialShape => ({
  quote: data.quote, author: data.author, role: data.role, company: data.company, avatar: data.avatar,
});
const query: QueryApi = {
  async list(collection, filter) {
    if (collection === 'pricing') {
      const result = await getEmDashCollection('pricing', filter);
      return { ...result, entries: result.entries.map((entry) => ({ ...entry, data: { ...entry.data, ...pricingShape(entry.data) } })) };
    }
    if (collection === 'testimonials') {
      const result = await getEmDashCollection('testimonials', filter);
      return { ...result, entries: result.entries.map((entry) => ({ ...entry, data: { ...entry.data, ...testimonialShape(entry.data) } })) };
    }
    throw new Error(`Unsupported page builder collection: ${collection}`);
  },
  async get(collection, id, options) { return getEmDashEntry(collection, id, options); },
};
export const sources = {
  pricing: createPricingSource({ groupField: 'service', query }),
  testimonials: createTestimonialsSource({ groupField: 'service', query }),
};
