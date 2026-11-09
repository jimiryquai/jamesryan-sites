import { hero, cta, features, testimonials, pricing, type BlockType, type Section, type SiteBlockType } from 'emdash-plugin-page-builder/blocks';
import Hero from './Hero.astro';
import CTA from './CTA.astro';
import Features from './Features.astro';
import Testimonials from './Testimonials.astro';
import Pricing from './Pricing.astro';

// Each adapter selects the UI section for the package's fixed variant vocabulary.
function withSections(block: BlockType, section: Section): SiteBlockType {
  return { ...block, sections: { default: section, ...Object.fromEntries(block.variants.map((variant) => [variant, section])) } };
}
export const blocks = [withSections(hero, Hero), withSections(cta, CTA), withSections(features, Features), withSections(testimonials, Testimonials), withSections(pricing, Pricing)];
