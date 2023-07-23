import { cache } from 'react';
import type { Chapter, Manga, Panel } from '@prisma/client';
import db from './db';
import { analyzePanels, loadPanels } from './tcb';

export const getMangaListing = cache(async (): Promise<Manga[]> => {
  return await db.manga.findMany();
});

export const getMangaDetail = cache(async (mangaSlug: string) => {
  return db.manga.findUnique({
    where: { key: mangaSlug },
    include: {
      chapters: {
        orderBy: { sort: 'desc' },
      },
    },
  });
});

export const getChapterDetail = cache(
  async (
    mangaKey: string,
    chapterKey: string,
    analyze = true,
  ): Promise<
    | (Chapter & {
        panels: Omit<Panel, 'id' | 'chapterId'>[];
        manga: Manga;
        prev?: Chapter;
        next?: Chapter;
      })
    | null
  > => {
    const chapter = await db.chapter.findFirst({
      where: { key: chapterKey, manga: { key: mangaKey } },
      include: {
        panels: {
          orderBy: {
            sort: 'asc',
          },
        },
        manga: true,
      },
    });

    if (!chapter) {
      return chapter;
    }
    const { prev, next } = (
      await db.chapter.findMany({
        where: {
          sort: {
            in: [chapter.sort - 1, chapter.sort + 1],
          },
          manga: { key: mangaKey },
        },
      })
    ).reduce<{ prev?: Chapter; next?: Chapter }>((neighbors, neighbor) => {
      if (neighbor.sort < chapter.sort) {
        neighbors.prev = neighbor;
      }
      if (neighbor.sort > chapter.sort) {
        neighbors.next = neighbor;
      }
      return neighbors;
    }, {});
    const actualPanels = await loadPanels(chapter);
    if (actualPanels.length > chapter.panels.length) {
      const indexed = new Set(chapter.panels.map((panel) => panel.src));
      const toIndex = actualPanels.filter((panel) => !indexed.has(panel.src));
      if (!analyze) {
        return {
          ...chapter,
          panels: [...chapter.panels, ...toIndex].sort(
            (a, b) => a.sort - b.sort,
          ) as Panel[],
          prev,
          next,
        };
      }
      const analyzed = (await analyzePanels(toIndex)).map((panel) => ({
        ...panel,
        chapterId: chapter.id,
      }));

      try {
        await db.panel.createMany({ data: analyzed });
      } catch (e) {
        console.error(
          `error during create many for ${mangaKey}/${chapterKey}`,
          analyzed,
        );
        throw new Error(
          `error during create many for ${mangaKey}/${chapterKey}`,
        );
      }
      return {
        ...chapter,
        panels: [...chapter.panels, ...analyzed].sort(
          (a, b) => a.sort - b.sort,
        ),
        prev,
        next,
      };
    }

    return { ...chapter, prev, next };
  },
);
