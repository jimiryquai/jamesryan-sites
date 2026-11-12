import { getImage } from 'astro:assets';
import { migrateBlocks, resolveSourceContext, isSourceResult, type StoredBlock } from 'emdash-plugin-page-builder/blocks';
import { getOfferedBlocks } from './offered-blocks.mjs';
import { sources } from './sources';

/**
 * The optimized image URL to preload for the layout's first `posts` block, or
 * "" when there is nothing to preload. The featured post is the first post
 * with an image — the same rule the featured-grid section renders — and its
 * image is Home's LCP. The posts read is shared per request with the section
 * that renders the block, so `/` reads the posts collection once.
 */
export async function resolveFeaturedPostPreload(
  layout: readonly StoredBlock[], group: string | undefined,
): Promise<string> {
  const offered = getOfferedBlocks();
  const posts = offered.find((block) => block.definition.slug === 'posts');
  if (!posts) return '';
  const block = migrateBlocks([...layout], offered).find(
    (candidate) => candidate._type === 'posts' && (candidate.variant ?? 'featured-grid') === 'featured-grid',
  );
  if (!block) return '';
  const read = await sources.posts(resolveSourceContext(block, posts, group));
  const items = isSourceResult(read) ? read.items : read;
  const featured = items.find((post) => post.image);
  const image = featured?.image;
  if (!image) return '';
  try {
    const optimized = await getImage({
      src: image.src || `/_emdash/api/media/file/${image.id}`,
      width: image.width || 1200,
      height: image.height || 750,
      format: 'webp',
    });
    return optimized.src;
  } catch (e) {
    console.error('Failed to generate preload image URL for the featured post:', e);
    return image.src || `/_emdash/api/media/file/${image.id}`;
  }
}
