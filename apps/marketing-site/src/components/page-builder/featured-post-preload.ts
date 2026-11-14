import { getImage } from 'astro:assets';
import { IMAGE_SLOTS, resolveResponsiveImagePreload, type ResponsiveImagePreload } from '@jamesryan/cms-helpers';
import { migrateBlocks, resolveSourceContext, isSourceResult, type StoredBlock } from 'emdash-plugin-page-builder/blocks';
import { getOfferedBlocks } from './offered-blocks.mjs';
import { sources } from './sources';

/**
 * The responsive image attributes to preload for the layout's first `posts` block, or
 * undefined when there is nothing to preload. The featured post is the first post
 * with an image — the same rule the featured-grid section renders — and its
 * image is Home's LCP. The posts read is shared per request with the section
 * that renders the block, so `/` reads the posts collection once.
 */
export async function resolveFeaturedPostPreload(
  layout: readonly StoredBlock[], group: string | undefined, origin: string,
): Promise<ResponsiveImagePreload | undefined> {
  const offered = getOfferedBlocks();
  const posts = offered.find((block) => block.definition.slug === 'posts');
  if (!posts) return undefined;
  const block = migrateBlocks([...layout], offered).find(
    (candidate) => candidate._type === 'posts' && (candidate.variant ?? 'featured-grid') === 'featured-grid',
  );
  if (!block) return undefined;
  const read = await sources.posts(resolveSourceContext(block, posts, group));
  const items = isSourceResult(read) ? read.items : read;
  const featured = items.find((post) => post.image);
  const image = featured?.image;
  if (!image) return undefined;
  return resolveResponsiveImagePreload(getImage, image, { origin, ...IMAGE_SLOTS.featuredPost });
}
