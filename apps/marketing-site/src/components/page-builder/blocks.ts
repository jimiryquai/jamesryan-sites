import type { BlockType, Section, SiteBlockType } from 'emdash-plugin-page-builder/blocks';
import { getOfferedBlocks } from './offered-blocks.mjs';
import Hero from './Hero.astro';
import CTA from './CTA.astro';
import Features from './Features.astro';
import Testimonials from './Testimonials.astro';
import Pricing from './Pricing.astro';

const sections: Record<string, Section> = { hero: Hero, cta: CTA, features: Features, testimonials: Testimonials, pricing: Pricing };
const offered = getOfferedBlocks();
const slugs = offered.map((block) => block.definition.slug);
const missing = slugs.filter((slug) => !Object.hasOwn(sections, slug));
const unoffered = Object.keys(sections).filter((slug) => !slugs.includes(slug));
if (missing.length || unoffered.length) {
  throw new Error(`Page builder sections do not match offered blocks: missing [${missing}], unoffered [${unoffered}]`);
}

// Each adapter selects the UI section for the package's fixed variant vocabulary.
function withSections(block: BlockType, section: Section): SiteBlockType {
  return { ...block, sections: { default: section, ...Object.fromEntries(block.variants.map((variant) => [variant, section])) } };
}
export const blocks = offered.map((block) => withSections(block, sections[block.definition.slug]));
