import type { BlockType, Section, Sections, SiteBlockType } from 'emdash-plugin-page-builder/blocks';
import { getOfferedBlocks } from './offered-blocks.mjs';
import Hero from './Hero.astro';
import CTA from './CTA.astro';
import Features from './Features.astro';
import Testimonials from './Testimonials.astro';
import Pricing from './Pricing.astro';
import Prose from './Prose.astro';
import FAQ from './FAQ.astro';
import Stats from './Stats.astro';
import Team from './Team.astro';
import Comparison from './Comparison.astro';
import PostsFeaturedGrid from './PostsFeaturedGrid.astro';
import PostsGrid from './PostsGrid.astro';
import PostsList from './PostsList.astro';

// Posts is the one block whose variants are distinct sections; every other
// block's variants are selected inside its single section.
const sections: Record<string, Section | Sections> = {
  hero: Hero, cta: CTA, features: Features, testimonials: Testimonials, pricing: Pricing, prose: Prose,
  faq: FAQ, stats: Stats, team: Team, comparison: Comparison,
  posts: { default: PostsFeaturedGrid, 'featured-grid': PostsFeaturedGrid, grid: PostsGrid, list: PostsList },
};
const offered = getOfferedBlocks();
const slugs = offered.map((block) => block.definition.slug);
const missing = slugs.filter((slug) => !Object.hasOwn(sections, slug));
const unoffered = Object.keys(sections).filter((slug) => !slugs.includes(slug));
if (missing.length || unoffered.length) {
  throw new Error(`Page builder sections do not match offered blocks: missing [${missing}], unoffered [${unoffered}]`);
}

// Each adapter attaches the site's sections to a package block: one section
// shared by every variant, or a per-variant map that still names a default.
function withSections(block: BlockType, section: Section | Sections): SiteBlockType {
  const sections: Sections = typeof section === 'function'
    ? { default: section, ...Object.fromEntries(block.variants.map((variant) => [variant, section])) }
    : section;
  if (typeof sections.default !== 'function') {
    throw new Error(`Page builder block ${block.definition.slug} has no default section`);
  }
  return { ...block, sections };
}
export const blocks = offered.map((block) => withSections(block, sections[block.definition.slug]));
