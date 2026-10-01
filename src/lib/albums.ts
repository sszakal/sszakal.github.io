import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

export interface AlbumPhoto {
  src: string;
  thumbnail: string;
}

export interface Album {
  slug: string;
  title: string;
  description: string;
  cover: AlbumPhoto;
  photos: AlbumPhoto[];
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function optimize(image: ImageMetadata): Promise<AlbumPhoto> {
  const [full, thumb] = await Promise.all([
    getImage({ src: image, width: 1200 }),
    getImage({ src: image, width: 750, format: "webp" }),
  ]);
  return { src: full.src, thumbnail: thumb.src };
}

let cache: Album[] | null = null;

export async function getAlbums(): Promise<Album[]> {
  if (cache) return cache;

  const imageFiles = import.meta.glob<{ default: ImageMetadata }>(
    "/src/assets/*/*.{jpg,jpeg,png,webp,avif,gif}",
  );
  // Optional per-album blurb: drop a description.txt next to the photos.
  const descriptionFiles = import.meta.glob("/src/assets/*/description.txt", {
    query: "?raw",
    import: "default",
  });

  const byAlbum = new Map<string, string[]>();
  for (const path of Object.keys(imageFiles)) {
    const slug = path.split("/").at(-2)!;
    if (!byAlbum.has(slug)) byAlbum.set(slug, []);
    byAlbum.get(slug)!.push(path);
  }

  const albums: Album[] = [];
  for (const [slug, paths] of byAlbum) {
    paths.sort();
    const photos = await Promise.all(
      paths.map(async (path) => {
        const mod = await imageFiles[path]();
        return optimize(mod.default);
      }),
    );

    const descPath = `/src/assets/${slug}/description.txt`;
    const description = descriptionFiles[descPath]
      ? ((await descriptionFiles[descPath]()) as string).trim()
      : `${photos.length} photo${photos.length === 1 ? "" : "s"}`;

    albums.push({
      slug,
      title: titleCase(slug),
      description,
      cover: photos[0],
      photos,
    });
  }

  albums.sort((a, b) => a.title.localeCompare(b.title));
  cache = albums;
  return albums;
}

export async function getAlbum(slug: string): Promise<Album | undefined> {
  const albums = await getAlbums();
  return albums.find((a) => a.slug === slug);
}
