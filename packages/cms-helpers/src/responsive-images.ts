/** Display slots shared by EmDash images and their responsive preloads. */
export const IMAGE_SLOTS = {
  card: { width: 800, height: 500, sizes: "(min-width: 1024px) 384px, (min-width: 640px) 50vw, calc(100vw - 3rem)" },
  featuredPost: { width: 1200, height: 750, sizes: "(min-width: 1024px) 720px, calc(100vw - 3rem)" },
  postHero: { width: 1200, height: 750, sizes: "(min-width: 1280px) 1200px, calc(100vw - 3rem)" },
  projectHero: { width: 1280, height: 720, sizes: "(min-width: 1280px) 1200px, calc(100vw - 3rem)" },
} as const;

type PreloadImage = string | {
  id?: string;
  src?: string;
  width?: number;
  height?: number;
  provider?: string;
  meta?: Record<string, unknown>;
};

type ImageOptions = {
  src: string;
  width: number;
  height: number;
  sizes: string;
  layout: "constrained";
  fit: "cover";
  position: "center";
};

/** Structural Astro boundary; importing this helper needs no Astro runtime. */
type GetImage = (options: ImageOptions) => Promise<{
  src: string;
  srcSet?: { attribute: string };
  attributes?: { sizes?: string };
}>;

export interface ResponsiveImagePreload {
  href: string;
  imagesrcset?: string;
  imagesizes?: string;
}

/** Resolve the same transform as EmDash's constrained Astro Image. */
export async function resolveResponsiveImagePreload(
  getImage: GetImage,
  image: PreloadImage,
  options: { origin: string; width?: number; height?: number; sizes: string },
): Promise<ResponsiveImagePreload> {
  const media = typeof image === "string" ? { src: image } : image;
  const rawSrc = media.src || `/_emdash/api/media/file/${media.meta?.storageKey || media.id}`;
  const fallback = { href: rawSrc };
  const width = options.width ?? media.width;
  const height = options.height ?? media.height;
  if (!width || !height || rawSrc.startsWith("//")) return fallback;
  if (!rawSrc.startsWith("/") && !/^https?:\/\//i.test(rawSrc)) return fallback;
  if (media.provider && media.provider !== "local" && !media.src) return fallback;
  try {
    const origin = new URL(options.origin);
    const absolute = new URL(rawSrc, origin);
    if (!['http:', 'https:'].includes(absolute.protocol) || absolute.origin !== origin.origin) return fallback;
    const result = await getImage({
      src: absolute.href, width, height, sizes: options.sizes,
      layout: "constrained", fit: "cover", position: "center",
    });
    if (result.src === absolute.href) return fallback;
    return {
      href: result.src,
      imagesrcset: result.srcSet?.attribute || undefined,
      imagesizes: result.attributes?.sizes ?? options.sizes,
    };
  } catch {
    return fallback;
  }
}
