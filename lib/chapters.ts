import { JSDOM } from 'jsdom';
import { cache } from 'react';
import slugify from 'slugify';
import { kv } from '@vercel/kv';
import { getPlaiceholder } from 'plaiceholder';

export interface IndexChapter {
  id: string;
  title: string;
  path: string;
  manga: Manga;
}

export interface Manga {
  slug: string;
  title: string;
  path: string;
  image: string;
}

const TCB_HOST = 'https://tcbscans.com/';
const MANGAS_ENDPOINT = '/projects';

export const isDefined = <T>(it: T | undefined | null): it is T => it != null;

export const getMangas = cache(async (): Promise<Manga[]> => {
  const html = await fetch(new URL(MANGAS_ENDPOINT, TCB_HOST));
  const {
    window: { document },
  } = new JSDOM(await html.text());

  interface MangaElements {
    title?: string;
    image?: string;
  }

  const mangaElements = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href^="/mangas"]'),
  ).reduce<Map<string, MangaElements>>((mangaElements, element) => {
    const path = new URL(element.href, 'https://localhost').pathname;
    const partialData: MangaElements = mangaElements.get(path) ?? {};
    if (!element.children.length) {
      partialData.title ??= element.innerHTML;
    } else {
      partialData.image ??=
        element.getElementsByTagName('img').item(0)?.src ?? undefined;
    }

    mangaElements.set(path, partialData);
    return mangaElements;
  }, new Map());

  return Array.from(mangaElements)
    .map(([path, { title, image }]) => {
      if (!title || !image) {
        return undefined;
      }
      return {
        slug: slugify(title.toLowerCase()).replace(':', '-'),
        title,
        path,
        image,
      };
    })
    .filter(isDefined);
});

export const getChapters = cache(
  async (mangaSlug: string): Promise<IndexChapter[] | undefined> => {
    const manga = (await getMangas()).find((manga) => manga.slug === mangaSlug);
    if (manga === undefined) {
      return undefined;
    }

    const html = await fetch(new URL(manga.path, TCB_HOST));
    const {
      window: { document },
    } = new JSDOM(await html.text());

    const chapterElements = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href^="/chapters"]'),
    );
    return chapterElements.map(({ href, children }) => {
      const [chapter, title] = Array.from(children).map((div) => div.innerHTML);
      const path = new URL(href, 'https://localhost').pathname;
      return {
        id: chapter.replace(/.*?(\d+)/, '$1'),
        title,
        path,
        manga,
      };
    });
  },
);

export interface Panel {
  missing: false;
  src: string;
  alt: string;
  width: number;
  height: number;
  base64: string;
}

export interface MissingPanel {
  missing: true;
  alt: string;
  src: string;
}

export interface DetailChapter extends IndexChapter {
  panels: (Panel | MissingPanel)[];
}

const mapInBatches = async <T, R>(
  items: T[],
  predicate: (item: T) => R | Promise<R>,
  batchSize = 8,
): Promise<R[]> => {
  const result: R[] = [];
  let batch: T[] = [];
  for (const item of items) {
    if (batch.length >= batchSize) {
      result.push(...(await Promise.all(batch.map(predicate))));
      batch = [];
    }
    batch.push(item);
  }
  result.push(...(await Promise.all(batch.map(predicate))));
  return result;
};

const getPanelData = cache(
  async (src: string, alt: string): Promise<Panel | MissingPanel> => {
    console.warn(`analyzing image "${alt}" from ${src}`);
    const response = await fetch(src);
    if (response.status === 404) {
      return {
        missing: true,
        src,
        alt,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const {
      base64,
      metadata: { width, height },
    } = await getPlaiceholder(buffer, { size: 10 });
    return { missing: false, src, alt, width, height, base64 };
  },
);

export const getChapter = cache(
  async (mangaSlug: string, id: string): Promise<DetailChapter | undefined> => {
    const cached = await kv.hget<DetailChapter>(mangaSlug, id);
    if (cached) {
      return cached;
    }

    const chapter = (await getChapters(mangaSlug))?.find(
      (chapter) => chapter.id === id,
    );
    if (chapter === undefined) {
      return undefined;
    }

    console.warn(`cache miss for chapter '${mangaSlug}:${id}'`);
    const html = await fetch(new URL(chapter.path, TCB_HOST));
    const {
      window: { document },
    } = new JSDOM(await html.text());
    const imageElements = Array.from(
      document.querySelectorAll<HTMLImageElement>('img.fixed-ratio-content'),
    );
    const panels: (Panel | MissingPanel)[] = await mapInBatches(
      imageElements,
      async ({ src, alt }) => await getPanelData(src, alt),
    );

    const result: DetailChapter = { ...chapter, panels: panels };

    await kv.hset(mangaSlug, { [id]: result });
    return result;
  },
);
