import { JSDOM } from 'jsdom';
import { cache } from 'react';
import slugify from 'slugify';
import type { Chapter, Manga, Panel } from '@prisma/client';
import { getPlaiceholder } from 'plaiceholder';
import db from './db';
import { isDefined, mapConcurrently } from './util';
import type { SetOptional, SetRequired } from 'type-fest';

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
): Promise<
  (Manga & { chapters: (Chapter & { panels: Panel[] })[] }) | null
> => {
  const manga = await db.manga.findUnique({
    where: { key: mangaKey },
    include: {
      chapters: {
        orderBy: { sort: 'desc' },
        include: { panels: { orderBy: { sort: 'asc' }, take: 1 } },
      },
    },
  });

  if (!manga) {
    return manga;
  }

  const indexed = new Map(
    manga?.chapters.map((chapter) => [chapter.key, chapter]),
  );

  const chaptersFromTcb = await loadChapters({ path: manga?.path });
  const chapters: (Chapter & { panels: Panel[] })[] = await Promise.all(
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
        include: {
          panels: { orderBy: { sort: 'asc' }, take: 1 },
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
  const html = await fetch(new URL(manga.path, TCB_HOST), {
    next: {
      revalidate: 900,
    },
  });
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
    const panelIndex = chapter.panels.reduce<Map<number, Panel>>(
      (acc, panel) => {
        acc.set(panel.sort, panel);
        return acc;
      },
      new Map(),
    );

    const toUpdate: SetRequired<Partial<Panel>, 'id'>[] = [];
    const toInsert: Pick<Panel, 'src' | 'sort' | 'title' | 'chapterId'>[] = [];

    imageElements.forEach(({ src, alt: title }, sort) => {
      const dbPanel = panelIndex.get(sort);
      if (!dbPanel) {
        toInsert.push({
          sort,
          src,
          title,
          chapterId: chapter.id,
        });
        return;
      }
      panelIndex.delete(sort);

      let hasChanges = false;

      const changes: (typeof toUpdate)[number] = { id: dbPanel.id };

      if (src !== dbPanel.src) {
        hasChanges = true;
        changes.src = src;
        changes.missing = false;
        changes.width = null;
        changes.height = null;
        changes.blurDataUrl = null;
      }

      if (title !== dbPanel.title) {
        hasChanges = true;
        changes.title = title;
      }

      if (!hasChanges) {
        return;
      }

      toUpdate.push({
        id: dbPanel.id,
        src,
        title,
      });
    });

    const hasChanges = await db.$transaction(async (tx) => {
      const toDelete = Array.from(panelIndex).map(([, panel]) => panel.id);
      if (toDelete.length) {
        await tx.panel.deleteMany({ where: { id: { in: toDelete } } });
      }
      if (toUpdate.length) {
        await Promise.all(
          toUpdate.map((panel) =>
            tx.panel.update({
              data: panel,
              where: { id: panel.id },
            }),
          ),
        );
      }
      if (toInsert.length) {
        await tx.panel.createMany({ data: toInsert });
      }
      return toDelete.length || toUpdate.length || toInsert.length;
    });

    if (!hasChanges) {
      return chapter;
    }

    const panels = await db.panel.findMany({
      where: { chapterId: chapter.id },
      orderBy: { sort: 'asc' },
    });

    if (!panels.length) {
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
