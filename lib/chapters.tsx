import { JSDOM } from "jsdom";
import { cache } from "react";
import probe from "probe-image-size";
import slugify from "slugify";

export interface IndexChapter {
  id: string;
  title: string;
  path: string;
}

export interface Manga {
  slug: string;
  title: string;
  path: string;
  image: string;
}

const TCB_HOST = "https://tcbscans.com/";
const MANGAS_ENDPOINT = "/projects";

const isDefined = <T,>(it: T | undefined | null): it is T => it != null;

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
    const path = new URL(element.href, "https://localhost").pathname;
    const partialData: MangaElements = mangaElements.get(path) ?? {};
    if (!element.children.length) {
      partialData.title ??= element.innerHTML;
    } else {
      partialData.image ??=
        element.getElementsByTagName("img").item(0)?.src ?? undefined;
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
        slug: slugify(title.toLowerCase()).replace(":", "-"),
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
      const path = new URL(href, "https://localhost").pathname;
      return {
        id: chapter.replace(/.*?(\d+)/, "$1"),
        title,
        path,
      };
    });
  },
);

export interface Page {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface DetailChapter extends IndexChapter {
  pages: Page[];
}

const getImageSize = cache(
  async (src: string): Promise<{ width: number; height: number }> => {
    const { width, height } = await probe(src);
    return { width, height };
  },
);

export const getChapter = cache(
  async (mangaSlug: string, id: string): Promise<DetailChapter | undefined> => {
    const chapter = (await getChapters(mangaSlug))?.find(
      (chapter) => chapter.id === id,
    );
    if (chapter === undefined) {
      return undefined;
    }

    const html = await fetch(new URL(chapter.path, TCB_HOST));
    const {
      window: { document },
    } = new JSDOM(await html.text());
    const imageElements = Array.from(
      document.querySelectorAll<HTMLImageElement>("img.fixed-ratio-content"),
    );
    const pages = await Promise.all(
      imageElements.map(async ({ src, alt }) => ({
        src,
        alt,
        ...(await getImageSize(src)),
      })),
    );
    return { ...chapter, pages };
  },
);
