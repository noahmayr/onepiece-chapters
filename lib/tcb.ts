import { JSDOM } from 'jsdom';
import { cache } from 'react';
import slugify from 'slugify';
import type { Chapter, Manga, Panel } from '@prisma/client';
import { getPlaiceholder } from 'plaiceholder';
import db from './db';
import { isDefined, mapConcurrently } from './util';
import type { SetOptional } from 'type-fest';

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
  async <T extends Chapter & { panels: Panel[] }>(
    chapter: T,
  ): Promise<T & { panels: SetOptional<Panel, 'id' | 'chapterId'>[] }> => {
    const html = await fetch(new URL(chapter.path, TCB_HOST));
    const {
      window: { document },
    } = new JSDOM(await html.text());
    const imageElements = Array.from(
      document.querySelectorAll<HTMLImageElement>('img.fixed-ratio-content'),
    );
    const panelIndex = chapter.panels.reduce<Map<string, Panel>>(
      (acc, panel) => {
        acc.set(panel.src, panel);
        return acc;
      },
      new Map(),
    );

    const upsert: Omit<Panel, 'id'>[] = [];

    imageElements.forEach(({ src, alt: title }, sort) => {
      const dbPanel = panelIndex.get(src);
      const needsUpsert = dbPanel?.sort !== sort || dbPanel?.title !== title;
      if (!needsUpsert) {
        return;
      }

      upsert.push({
        sort,
        src,
        title,
        missing: dbPanel?.missing ?? false,
        width: dbPanel?.width ?? null,
        height: dbPanel?.height ?? null,
        blurDataUrl: dbPanel?.blurDataUrl ?? null,
        chapterId: chapter.id,
      });
    });

    if (!upsert.length) {
      return chapter;
    }

    await db.$transaction(
      upsert.map((panel) => {
        console.log(`upserting ${chapter.key}/${panel.sort}`);
        return db.panel.upsert({
          create: panel,
          update: panel,
          where: { src: panel.src },
        });
      }),
    );

    const panels = (
      await db.chapter.findUnique({
        where: { id: chapter.id },
        include: { panels: { orderBy: { sort: 'asc' } } },
      })
    )?.panels;

    if (!panels) {
      console.error(
        `failed to load panels for chapter id ${chapter.id} after updating them. This should not be possible`,
      );
      return chapter;
    }

    return { ...chapter, panels };
  },
);

export const analyzePanels = cache(
  async (panels: Panel[]): Promise<Panel[]> => {
    const result = await mapConcurrently(panels, async (panel) => {
      if (panel.missing || (panel.blurDataUrl && panel.width && panel.height)) {
        console.log(`panel ${panel.id} is missing or analyzed already`);
        return panel;
      }

      console.log(`loading "${panel.title}": ${panel.src}`);
      const response = await fetch(panel.src);
      if (response.status !== 200) {
        return await db.panel.update({
          data: { ...panel, missing: true },
          where: { id: panel.id },
        });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const {
        base64: blurDataUrl,
        metadata: { width, height },
      } = await getPlaiceholder(buffer);
      const analyzed = {
        ...panel,
        width,
        height,
        blurDataUrl,
        missing: false,
      };
      const result = await db.panel.update({
        data: analyzed,
        where: { id: panel.id },
      });
      return result;
    });
    return result.filter(isDefined).sort((a, b) => a.sort - b.sort);
  },
);
