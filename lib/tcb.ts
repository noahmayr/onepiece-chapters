import { JSDOM } from 'jsdom';
import { cache } from 'react';
import slugify from 'slugify';
import type { Chapter, Manga, Panel } from '@prisma/client';
import { getPlaiceholder } from 'plaiceholder';
import db from './db';
import { isDefined, mapConcurrently } from './util';

const TCB_HOST = 'https://tcbscans.com/';
const MANGAS_ENDPOINT = '/projects';

export const loadMangasFromTcb = cache(
  async (): Promise<Omit<Manga, 'id'>[]> => {
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
          key: slugify(title.toLowerCase()).replace(':', '-'),
          title,
          path,
          image,
        };
      })
      .filter(isDefined);
  },
);

export const indexChapters = async (
  mangaKey: string,
): Promise<(Manga & { chapters: Chapter[] }) | null> => {
  const manga = await db.manga.findUnique({
    where: { key: mangaKey },
    include: { chapters: { orderBy: { sort: 'desc' } } },
  });

  if (!manga) {
    return manga;
  }

  const indexed = new Map(
    manga?.chapters.map((chapter) => [chapter.key, chapter]),
  );

  const chaptersFromTcb = await loadChapters({ path: manga?.path });
  const chapters: Chapter[] = await Promise.all(
    chaptersFromTcb.reverse().map(async (data, sort) => {
      const existing = indexed.get(data.key);
      if (existing && existing.sort === sort) {
        return existing;
      }

      const chapter = {
        ...data,
        sort,
        mangaId: manga.id,
      };
      return await db.chapter.upsert({
        create: chapter,
        update: chapter,
        where: {
          key_mangaId: {
            key: chapter.key,
            mangaId: manga.id,
          },
        },
      });
    }),
  );

  return {
    ...manga,
    chapters: chapters.reverse(),
  };
};

export const loadChapters = cache(async (manga: Pick<Manga, 'path'>) => {
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
      key: chapter.replace(/.*?(\d+)/, '$1'),
      title,
      path,
    };
  });
});

export const loadPanels = cache(
  async (
    chapter: Pick<Chapter, 'path'>,
  ): Promise<Pick<Panel, 'src' | 'title' | 'sort'>[]> => {
    const html = await fetch(new URL(chapter.path, TCB_HOST));
    const {
      window: { document },
    } = new JSDOM(await html.text());
    const imageElements = Array.from(
      document.querySelectorAll<HTMLImageElement>('img.fixed-ratio-content'),
    );

    return imageElements.map(({ src, alt }, sort) => {
      return {
        sort,
        src,
        title: alt,
      };
    });
  },
);

export const analyzePanels = cache(
  async (
    panels: Pick<Panel, 'src' | 'title' | 'sort'>[],
  ): Promise<Omit<Panel, 'id' | 'chapterId'>[]> => {
    return (
      await mapConcurrently(panels, async (panel) => {
        const response = await fetch(panel.src);
        if (response.status !== 200) {
          console.error(`got status 404 for "${panel.title}": ${panel.src}`);
          return undefined;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const {
          base64: blurDataUrl,
          metadata: { width, height },
        } = await getPlaiceholder(buffer);
        return { ...panel, width, height, blurDataUrl };
      })
    ).filter(isDefined);
  },
);
